<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Bolt, MinusCircle, PlusCircle, RefreshCw, Settings, XCircle } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PortRange, PortRecord, PortWatchPreferences, RefreshProfile } from './types'

type PanelMode = 'ports' | 'settings'
type IntervalKey = 'liveRefreshInterval' | 'normalRefreshInterval'
type PortRangeKey = 'lowerBound' | 'upperBound'

const defaultPreferences: PortWatchPreferences = {
  selectedRefreshProfile: 'normal',
  liveRefreshInterval: 1,
  normalRefreshInterval: 5,
  monitoredPortRanges: [
    { id: 'default', lowerBound: 0, upperBound: 65535 }
  ]
}

const records = ref<PortRecord[]>([])
const preferences = ref<PortWatchPreferences>(structuredClone(defaultPreferences))
const selectedId = ref<string>()
const panelMode = ref<PanelMode>('ports')
const isLoading = ref(false)
const isKilling = ref(false)
const isCheckingUpdate = ref(false)
const errorMessage = ref<string>()
const updateMessage = ref<string>()
let refreshTimer: number | undefined
let cleanupRefreshRequested: (() => void) | undefined
let cleanupUpdateCheckRequested: (() => void) | undefined

const selectedProfile = computed(() => preferences.value.selectedRefreshProfile)
const refreshMs = computed(() => {
  const seconds = selectedProfile.value === 'live'
    ? preferences.value.liveRefreshInterval
    : preferences.value.normalRefreshInterval
  return Math.max(250, Math.round(seconds * 1000))
})

async function refresh(): Promise<void> {
  isLoading.value = true
  errorMessage.value = undefined
  try {
    records.value = await window.portwatch.listPorts()
    reconcileSelection()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

async function terminate(record: PortRecord): Promise<void> {
  isKilling.value = true
  try {
    await window.portwatch.terminatePortProcess(record.pid)
    await refresh()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isKilling.value = false
  }
}

async function checkUpdates(): Promise<void> {
  isCheckingUpdate.value = true
  errorMessage.value = undefined
  updateMessage.value = undefined
  try {
    const status = await window.portwatch.checkForUpdates()
    updateMessage.value = status.message
    if (status.available && window.confirm(`${status.message}\n\nInstall now?`)) {
      const installStatus = await window.portwatch.installUpdate()
      updateMessage.value = installStatus.message
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isCheckingUpdate.value = false
  }
}

async function loadPreferences(): Promise<void> {
  preferences.value = await window.portwatch.getPreferences()
}

async function persistPreferences(refreshAfterSave = false): Promise<void> {
  preferences.value = await window.portwatch.setPreferences(preferences.value)
  scheduleRefresh()
  if (refreshAfterSave) {
    await refresh()
  }
}

async function selectRefreshProfile(profile: RefreshProfile): Promise<void> {
  preferences.value = {
    ...preferences.value,
    selectedRefreshProfile: profile
  }
  await persistPreferences()
}

async function updateInterval(key: IntervalKey, event: Event): Promise<void> {
  const value = Number((event.target as HTMLInputElement).value)
  preferences.value = {
    ...preferences.value,
    [key]: Number.isFinite(value) ? value : preferences.value[key]
  }
  await persistPreferences()
}

async function addPortRange(): Promise<void> {
  preferences.value = {
    ...preferences.value,
    monitoredPortRanges: [
      ...preferences.value.monitoredPortRanges,
      { id: crypto.randomUUID(), lowerBound: 0, upperBound: 10000 }
    ]
  }
  await persistPreferences(true)
}

async function removePortRange(id: string): Promise<void> {
  const nextRanges = preferences.value.monitoredPortRanges.filter((range) => range.id !== id)
  preferences.value = {
    ...preferences.value,
    monitoredPortRanges: nextRanges.length > 0 ? nextRanges : defaultPreferences.monitoredPortRanges
  }
  await persistPreferences(true)
}

async function updatePortRange(id: string, key: PortRangeKey, event: Event): Promise<void> {
  const value = Number((event.target as HTMLInputElement).value)
  preferences.value = {
    ...preferences.value,
    monitoredPortRanges: preferences.value.monitoredPortRanges.map((range) => {
      if (range.id !== id) return range
      return {
        ...range,
        [key]: Number.isFinite(value) ? value : range[key]
      }
    })
  }
  await persistPreferences(true)
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

function uptime(seconds?: number): string {
  if (seconds === undefined) return ''
  const value = Math.max(0, Math.floor(seconds))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${value}s`
}

function source(record: PortRecord): string {
  return record.source ?? record.workingDirectory ?? record.executablePath ?? 'Unavailable'
}

function normalizedRange(range: PortRange): string {
  const lower = Math.min(range.lowerBound, range.upperBound)
  const upper = Math.max(range.lowerBound, range.upperBound)
  return `${lower}-${upper}`
}

watch(refreshMs, scheduleRefresh)

onMounted(async () => {
  await loadPreferences()
  await refresh()
  scheduleRefresh()
  cleanupRefreshRequested = window.portwatch.onRefreshRequested(refresh)
  cleanupUpdateCheckRequested = window.portwatch.onUpdateCheckRequested(checkUpdates)
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  cleanupRefreshRequested?.()
  cleanupUpdateCheckRequested?.()
})
</script>

<template>
  <main class="flex h-full flex-col gap-2 bg-background p-2">
    <header class="flex h-12 shrink-0 items-center rounded-lg border border-border/60 bg-white/90 pl-[84px] pr-2 shadow-sm">
      <Badge>{{ records.length }}</Badge>

      <div class="ml-auto flex items-center gap-2">
        <div v-if="panelMode === 'ports'" class="flex rounded-full bg-white p-1 shadow-sm">
          <Button
            variant="ghost"
            :class="selectedProfile === 'live' && 'bg-primary text-primary-foreground hover:bg-primary/90'"
            @click="selectRefreshProfile('live')"
          >
            Live
          </Button>
          <Button
            variant="ghost"
            :class="selectedProfile === 'normal' && 'bg-primary text-primary-foreground hover:bg-primary/90'"
            @click="selectRefreshProfile('normal')"
          >
            Normal
          </Button>
        </div>

        <Button v-if="panelMode === 'settings'" variant="ghost" size="icon" title="Back" @click="panelMode = 'ports'">
          <ArrowLeft class="size-4" />
        </Button>
        <Button v-if="panelMode === 'ports'" variant="ghost" size="icon" title="Refresh" @click="refresh">
          <RefreshCw class="size-4" :class="isLoading && 'animate-spin'" />
        </Button>
        <Button v-if="panelMode === 'ports'" variant="ghost" size="icon" title="Settings" @click="panelMode = 'settings'">
          <Settings class="size-4" />
        </Button>
      </div>
    </header>

    <section class="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2">
      <div v-if="errorMessage" class="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
        {{ errorMessage }}
      </div>
      <div v-if="updateMessage" class="mb-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        {{ updateMessage }}
      </div>

      <div v-if="panelMode === 'ports'" class="h-full overflow-y-auto pr-1">
        <div
          v-for="record in records"
          :key="record.id"
          role="button"
          tabindex="0"
          class="mb-2 block w-full overflow-hidden rounded-lg text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @click="selectedId = record.id"
          @keydown.enter="selectedId = record.id"
        >
          <div
            class="flex items-start gap-3 rounded-lg px-3 py-3"
            :class="record.id === selectedId ? 'rounded-b-sm bg-[#f4f2eb]' : 'bg-[#fbfaf7]'"
          >
            <div
              class="flex h-10 w-12 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold"
              :class="record.id === selectedId ? 'bg-[#24996f] text-white' : 'bg-muted text-foreground/75'"
            >
              {{ record.port }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-start gap-2">
                <div class="truncate text-base font-bold leading-5">{{ record.command }}</div>
                <div class="ml-auto shrink-0 font-mono text-xs font-medium text-muted-foreground">{{ uptime(record.uptime) }}</div>
              </div>
              <div class="mt-1 truncate text-sm font-medium text-muted-foreground">{{ source(record) }}</div>
            </div>
          </div>

          <div
            v-if="record.id === selectedId"
            class="flex items-start gap-3 rounded-b-lg bg-[#f4f2eb] px-3 pb-4 pt-1"
          >
            <div class="grid min-w-0 flex-1 grid-cols-[86px_1fr] gap-x-4 gap-y-2">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Launch</div>
                <div class="truncate text-sm font-semibold text-foreground/80">{{ record.launchedBy ?? 'Unknown' }}</div>
              </div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">PID</div>
                <div class="truncate text-sm font-semibold text-foreground/80">{{ record.pid }}</div>
              </div>
              <div class="col-span-2">
                <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Source</div>
                <div class="line-clamp-2 text-sm font-semibold text-foreground/80">{{ source(record) }}</div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              class="mt-4 rounded-full bg-white/80 text-destructive hover:bg-white"
              :disabled="isKilling"
              title="Terminate process"
              @click.stop="terminate(record)"
            >
              <XCircle class="size-5" />
            </Button>
          </div>
        </div>
      </div>

      <div v-else class="h-full overflow-y-auto pr-1">
        <div class="space-y-2">
          <section class="rounded-lg bg-[#fbfaf7] p-3">
            <div class="mb-3 text-sm font-bold">Refresh Rates</div>
            <label class="mb-2 flex items-center gap-3 text-sm font-semibold text-foreground/75">
              <span class="flex-1">Live interval</span>
              <input
                class="h-8 w-20 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
                type="number"
                min="0.5"
                step="0.5"
                :value="preferences.liveRefreshInterval"
                @change="updateInterval('liveRefreshInterval', $event)"
              >
              <span class="text-xs text-muted-foreground">sec</span>
            </label>
            <label class="flex items-center gap-3 text-sm font-semibold text-foreground/75">
              <span class="flex-1">Normal interval</span>
              <input
                class="h-8 w-20 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
                type="number"
                min="1"
                step="1"
                :value="preferences.normalRefreshInterval"
                @change="updateInterval('normalRefreshInterval', $event)"
              >
              <span class="text-xs text-muted-foreground">sec</span>
            </label>
          </section>

          <section class="rounded-lg bg-[#fbfaf7] p-3">
            <div class="mb-3 flex items-center gap-2">
              <div class="text-sm font-bold">Port Ranges</div>
              <Button class="ml-auto" variant="ghost" size="icon-sm" title="Add port range" @click="addPortRange">
                <PlusCircle class="size-4" />
              </Button>
            </div>

            <div v-for="range in preferences.monitoredPortRanges" :key="range.id" class="mb-2 flex items-center gap-2 last:mb-0">
              <input
                class="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
                type="number"
                min="0"
                max="65535"
                :title="normalizedRange(range)"
                :value="range.lowerBound"
                @change="updatePortRange(range.id, 'lowerBound', $event)"
              >
              <span class="text-xs font-bold text-muted-foreground">to</span>
              <input
                class="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
                type="number"
                min="0"
                max="65535"
                :title="normalizedRange(range)"
                :value="range.upperBound"
                @change="updatePortRange(range.id, 'upperBound', $event)"
              >
              <Button variant="ghost" size="icon-sm" class="text-destructive" title="Remove port range" @click="removePortRange(range.id)">
                <MinusCircle class="size-4" />
              </Button>
            </div>
          </section>

          <section class="rounded-lg bg-[#fbfaf7] p-3">
            <div class="mb-2 text-sm font-bold">Updates</div>
            <p class="mb-3 text-xs font-medium leading-5 text-muted-foreground">
              {{ updateMessage || 'Velopack updates are enabled when PORTWATCH_UPDATE_URL is configured.' }}
            </p>
            <Button variant="outline" size="sm" :disabled="isCheckingUpdate" @click="checkUpdates">
              <Bolt class="size-4" :class="isCheckingUpdate && 'animate-pulse'" />
              Check updates
            </Button>
          </section>
        </div>
      </div>
    </section>
  </main>
</template>
