import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import {
  createDefaultMonitoredPortRanges,
  createDefaultPreferences,
  getPortRangeBounds,
} from '../../shared/preferences'
import type { PortRange, PortWatchPreferences, StarredPort } from '../../shared/types'

let preferencesStore: Store<PortWatchPreferences> | undefined

export async function loadPreferences(): Promise<PortWatchPreferences> {
  const store = getPreferencesStore()
  const sanitized = sanitizePreferences(store.store)
  if (!preferencesEqual(store.store, sanitized)) {
    store.store = sanitized
  }
  return sanitized
}

export async function savePreferences(
  preferences: PortWatchPreferences,
): Promise<PortWatchPreferences> {
  const sanitized = sanitizePreferences(preferences)
  getPreferencesStore().store = sanitized
  return sanitized
}

export function portMatchesPreferences(port: number, preferences: PortWatchPreferences): boolean {
  return preferences.monitoredPortRanges.some((range) => {
    const { lowerBound, upperBound } = getPortRangeBounds(range)
    return port >= lowerBound && port <= upperBound
  })
}

function getPreferencesStore(): Store<PortWatchPreferences> {
  preferencesStore ??= new Store<PortWatchPreferences>({
    name: 'preferences',
    defaults: createDefaultPreferences(),
    clearInvalidConfig: true,
  })
  return preferencesStore
}

function sanitizePreferences(value: unknown): PortWatchPreferences {
  const defaultPreferences = createDefaultPreferences()
  const input = value as Partial<PortWatchPreferences>
  const ranges = Array.isArray(input.monitoredPortRanges)
    ? (input.monitoredPortRanges.map(sanitizeRange).filter(Boolean) as PortRange[])
    : []
  const starredPorts = Array.isArray(input.starredPorts)
    ? dedupeStarredPorts(
        input.starredPorts.map(sanitizeStarredPort).filter(Boolean) as StarredPort[],
      )
    : []

  return {
    selectedRefreshProfile: input.selectedRefreshProfile === 'live' ? 'live' : 'normal',
    liveRefreshInterval: clampNumber(
      input.liveRefreshInterval,
      0.5,
      60,
      defaultPreferences.liveRefreshInterval,
    ),
    normalRefreshInterval: clampNumber(
      input.normalRefreshInterval,
      1,
      300,
      defaultPreferences.normalRefreshInterval,
    ),
    monitoredPortRanges: ranges.length > 0 ? ranges : createDefaultMonitoredPortRanges(),
    starredPorts,
  }
}

function sanitizeRange(value: unknown): PortRange | undefined {
  const range = value as Partial<PortRange>
  const lowerBound = clampInteger(range.lowerBound, 0, 65535, 0)
  const upperBound = clampInteger(range.upperBound, 0, 65535, 65535)

  return {
    id: typeof range.id === 'string' && range.id.length > 0 ? range.id : randomUUID(),
    lowerBound,
    upperBound,
  }
}

function sanitizeStarredPort(value: unknown): StarredPort | undefined {
  const starredPort = value as Partial<StarredPort>
  const path = typeof starredPort.path === 'string' ? starredPort.path.trim() : ''
  if (path.length === 0) {
    return undefined
  }

  return {
    port: clampInteger(starredPort.port, 0, 65535, 0),
    path,
  }
}

function dedupeStarredPorts(starredPorts: StarredPort[]): StarredPort[] {
  const seen = new Set<string>()
  return starredPorts.filter((starredPort) => {
    const key = `${starredPort.port}:${starredPort.path}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function preferencesEqual(left: PortWatchPreferences, right: PortWatchPreferences): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback))
}
