import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { UpdateStatus } from '../../../shared/types'
import type { PortRecord, PortWatchPreferences, RefreshProfile, WindowPlatform } from '../types'
import {
  createDefaultMonitoredPortRanges,
  createDefaultPreferences,
  type IntervalUpdate,
  type PortRangeUpdate,
} from '../lib/preferences'
import { buildStarredPort } from '../lib/ports'

const NEW_RECORD_HIGHLIGHT_DURATION_MS = 20_000

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function serializePreferences(preferences: PortWatchPreferences): PortWatchPreferences {
  return {
    selectedRefreshProfile: preferences.selectedRefreshProfile,
    liveRefreshInterval: preferences.liveRefreshInterval,
    normalRefreshInterval: preferences.normalRefreshInterval,
    monitoredPortRanges: preferences.monitoredPortRanges.map((range) => ({
      id: range.id,
      lowerBound: range.lowerBound,
      upperBound: range.upperBound,
    })),
    starredPorts: preferences.starredPorts.map((starredPort) => ({
      port: starredPort.port,
      path: starredPort.path,
    })),
  }
}

async function minimizeWindow(): Promise<void> {
  await window.portwatch.minimizeWindow()
}

async function closeWindow(): Promise<void> {
  await window.portwatch.closeWindow()
}

interface UpdateCheckOptions {
  quiet?: boolean
}

export function usePortWatch() {
  const records = ref<PortRecord[]>([])
  const highlightedRecordIds = ref<string[]>([])
  const preferences = ref<PortWatchPreferences>(createDefaultPreferences())
  const selectedId = ref<string>()
  const isKilling = ref(false)
  const isCheckingUpdate = ref(false)
  const platform = ref<WindowPlatform>('darwin')
  const isFullScreen = ref(false)
  const errorMessage = ref<string>()
  const updateMessage = ref<string>()
  const latestUpdateStatus = ref<UpdateStatus>()
  let refreshTimer: number | undefined
  let hasLoadedRecords = false
  let cleanupRefreshRequested: (() => void) | undefined
  let cleanupUpdateCheckRequested: (() => void) | undefined
  let cleanupWindowStateChanged: (() => void) | undefined
  const highlightTimers = new Map<string, number>()

  const selectedProfile = computed(() => preferences.value.selectedRefreshProfile)
  const isMac = computed(() => platform.value === 'darwin')
  const showCustomWindowControls = computed(
    () => platform.value !== 'darwin' && platform.value !== 'win32',
  )
  const hasUpdateBadge = computed(() => latestUpdateStatus.value?.available === true)
  const updateBadgeLabel = computed(() => (hasUpdateBadge.value ? 'Update' : undefined))
  const updateBadgeTitle = computed(() =>
    latestUpdateStatus.value?.pendingRestart
      ? 'Restart to apply update'
      : 'Download and install update',
  )
  const refreshMs = computed(() => {
    const seconds =
      selectedProfile.value === 'live'
        ? preferences.value.liveRefreshInterval
        : preferences.value.normalRefreshInterval
    return Math.max(250, Math.round(seconds * 1000))
  })

  async function updatePreferences(
    updater: (current: PortWatchPreferences) => PortWatchPreferences,
    refreshAfterSave = false,
  ): Promise<void> {
    const previousPreferences = serializePreferences(preferences.value)
    try {
      preferences.value = serializePreferences(updater(previousPreferences))
      await persistPreferences(refreshAfterSave)
    } catch (error) {
      preferences.value = previousPreferences
      errorMessage.value = toErrorMessage(error)
    }
  }

  function clearRecordHighlight(recordId: string): void {
    const timer = highlightTimers.get(recordId)
    if (timer) {
      window.clearTimeout(timer)
      highlightTimers.delete(recordId)
    }

    if (highlightedRecordIds.value.includes(recordId)) {
      highlightedRecordIds.value = highlightedRecordIds.value.filter((id) => id !== recordId)
    }
  }

  function highlightNewRecord(recordId: string): void {
    if (!highlightedRecordIds.value.includes(recordId)) {
      highlightedRecordIds.value = [...highlightedRecordIds.value, recordId]
    }

    const existingTimer = highlightTimers.get(recordId)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    const timer = window.setTimeout(() => {
      clearRecordHighlight(recordId)
    }, NEW_RECORD_HIGHLIGHT_DURATION_MS)
    highlightTimers.set(recordId, timer)
  }

  function reconcileHighlights(nextRecords: PortRecord[], previousRecords: PortRecord[]): void {
    const nextIds = new Set(nextRecords.map((record) => record.id))

    for (const id of highlightedRecordIds.value.slice()) {
      if (!nextIds.has(id)) {
        clearRecordHighlight(id)
      }
    }

    if (!hasLoadedRecords) {
      hasLoadedRecords = true
      return
    }

    const previousIds = new Set(previousRecords.map((record) => record.id))
    for (const record of nextRecords) {
      if (!previousIds.has(record.id)) {
        highlightNewRecord(record.id)
      }
    }
  }

  async function refresh(options?: { suppressHighlights?: boolean }): Promise<void> {
    errorMessage.value = undefined
    try {
      const previousRecords = records.value
      const nextRecords = await window.portwatch.listPorts()
      records.value = nextRecords
      if (options?.suppressHighlights) {
        for (const id of highlightedRecordIds.value.slice()) {
          if (!nextRecords.some((record) => record.id === id)) {
            clearRecordHighlight(id)
          }
        }
        hasLoadedRecords = true
      } else {
        reconcileHighlights(nextRecords, previousRecords)
      }
      reconcileSelection()
    } catch (error) {
      errorMessage.value = toErrorMessage(error)
    }
  }

  async function terminate(record: PortRecord): Promise<void> {
    isKilling.value = true
    try {
      await window.portwatch.terminatePortProcess(record.pid)
      await refresh({ suppressHighlights: true })
    } catch (error) {
      errorMessage.value = toErrorMessage(error)
    } finally {
      isKilling.value = false
    }
  }

  async function checkUpdates(options: UpdateCheckOptions = {}): Promise<void> {
    const { quiet = false } = options
    isCheckingUpdate.value = true
    if (!quiet) {
      errorMessage.value = undefined
      updateMessage.value = undefined
    }
    try {
      const status = await window.portwatch.checkForUpdates()
      latestUpdateStatus.value = status
      if (!quiet || status.available || status.pendingRestart) {
        updateMessage.value = status.message
      }
    } catch (error) {
      if (!quiet) {
        errorMessage.value = toErrorMessage(error)
      }
    } finally {
      isCheckingUpdate.value = false
    }
  }

  async function installUpdate(): Promise<void> {
    isCheckingUpdate.value = true
    errorMessage.value = undefined
    try {
      const status = await window.portwatch.installUpdate()
      latestUpdateStatus.value = status
      updateMessage.value = status.message
    } catch (error) {
      errorMessage.value = toErrorMessage(error)
    } finally {
      isCheckingUpdate.value = false
    }
  }

  async function toggleFullScreen(): Promise<void> {
    isFullScreen.value = await window.portwatch.toggleFullScreen()
  }

  async function loadPreferences(): Promise<void> {
    preferences.value = serializePreferences(await window.portwatch.getPreferences())
  }

  async function persistPreferences(refreshAfterSave = false): Promise<void> {
    const savedPreferences = await window.portwatch.setPreferences(
      serializePreferences(preferences.value),
    )
    preferences.value = serializePreferences(savedPreferences)
    scheduleRefresh()
    if (refreshAfterSave) {
      await refresh({ suppressHighlights: true })
    }
  }

  async function selectRefreshProfile(profile: RefreshProfile): Promise<void> {
    await updatePreferences((current) => ({
      ...current,
      selectedRefreshProfile: profile,
    }))
  }

  async function toggleRefreshProfile(): Promise<void> {
    await selectRefreshProfile(selectedProfile.value === 'live' ? 'normal' : 'live')
  }

  async function updateInterval({ key, value }: IntervalUpdate): Promise<void> {
    await updatePreferences((current) => ({
      ...current,
      [key]: value ?? current[key],
    }))
  }

  async function addPortRange(): Promise<void> {
    await updatePreferences(
      (current) => ({
        ...current,
        monitoredPortRanges: [
          ...current.monitoredPortRanges,
          { id: crypto.randomUUID(), lowerBound: 0, upperBound: 10000 },
        ],
      }),
      true,
    )
  }

  async function removePortRange(id: string): Promise<void> {
    await updatePreferences((current) => {
      const nextRanges = current.monitoredPortRanges.filter((range) => range.id !== id)
      return {
        ...current,
        monitoredPortRanges:
          nextRanges.length > 0 ? nextRanges : createDefaultMonitoredPortRanges(),
      }
    }, true)
  }

  async function updatePortRange({ id, key, value }: PortRangeUpdate): Promise<void> {
    await updatePreferences(
      (current) => ({
        ...current,
        monitoredPortRanges: current.monitoredPortRanges.map((range) => {
          if (range.id !== id) return range
          return {
            ...range,
            [key]: value ?? range[key],
          }
        }),
      }),
      true,
    )
  }

  async function toggleStarredPort(record: PortRecord): Promise<void> {
    const starredPort = buildStarredPort(record)
    if (!starredPort) {
      errorMessage.value = 'This port does not have a stable path to mark.'
      return
    }

    await updatePreferences((current) => {
      const alreadyStarred = current.starredPorts.some(
        (item) => item.port === starredPort.port && item.path === starredPort.path,
      )

      return {
        ...current,
        starredPorts: alreadyStarred
          ? current.starredPorts.filter(
              (item) => item.port !== starredPort.port || item.path !== starredPort.path,
            )
          : [...current.starredPorts, starredPort],
      }
    })
  }

  function selectRecord(id: string | undefined): void {
    if (id) {
      clearRecordHighlight(id)
    }
    selectedId.value = id
  }

  function scheduleRefresh(): void {
    if (refreshTimer) window.clearInterval(refreshTimer)
    refreshTimer = window.setInterval(refresh, refreshMs.value)
  }

  function reconcileSelection(): void {
    if (selectedId.value && records.value.some((record) => record.id === selectedId.value)) {
      return
    }

    selectedId.value = records.value[0]?.id
  }

  watch(refreshMs, scheduleRefresh)

  onMounted(async () => {
    const [{ isFullScreen: initialFullScreen, platform: initialPlatform }] = await Promise.all([
      window.portwatch.getWindowState(),
      loadPreferences(),
    ])
    document.documentElement.dataset.platform = initialPlatform
    await refresh()
    platform.value = initialPlatform
    isFullScreen.value = initialFullScreen
    scheduleRefresh()
    cleanupRefreshRequested = window.portwatch.onRefreshRequested(refresh)
    cleanupUpdateCheckRequested = window.portwatch.onUpdateCheckRequested(() => checkUpdates())
    cleanupWindowStateChanged = window.portwatch.onWindowStateChanged((state) => {
      isFullScreen.value = state.isFullScreen
    })
    if (!import.meta.env.DEV) {
      void checkUpdates({
        quiet: true,
      })
    }
  })

  onUnmounted(() => {
    if (refreshTimer) window.clearInterval(refreshTimer)
    for (const timer of highlightTimers.values()) {
      window.clearTimeout(timer)
    }
    highlightTimers.clear()
    cleanupRefreshRequested?.()
    cleanupUpdateCheckRequested?.()
    cleanupWindowStateChanged?.()
  })

  return {
    records,
    highlightedRecordIds,
    preferences,
    selectedId,
    selectRecord,
    selectedProfile,
    isKilling,
    isCheckingUpdate,
    isMac,
    showCustomWindowControls,
    hasUpdateBadge,
    updateBadgeLabel,
    updateBadgeTitle,
    isFullScreen,
    errorMessage,
    updateMessage,
    terminate,
    checkUpdates,
    installUpdate,
    minimizeWindow,
    closeWindow,
    toggleFullScreen,
    toggleRefreshProfile,
    updateInterval,
    addPortRange,
    removePortRange,
    updatePortRange,
    toggleStarredPort,
  }
}
