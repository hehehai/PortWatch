import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PortRange, PortWatchPreferences } from '../../shared/types'

export const defaultPreferences: PortWatchPreferences = {
  selectedRefreshProfile: 'normal',
  liveRefreshInterval: 1,
  normalRefreshInterval: 5,
  monitoredPortRanges: [
    { id: 'default', lowerBound: 0, upperBound: 65535 }
  ]
}

export async function loadPreferences(): Promise<PortWatchPreferences> {
  try {
    const raw = await readFile(preferencesPath(), 'utf8')
    return sanitizePreferences(JSON.parse(raw))
  } catch {
    return defaultPreferences
  }
}

export async function savePreferences(preferences: PortWatchPreferences): Promise<PortWatchPreferences> {
  const sanitized = sanitizePreferences(preferences)
  const path = preferencesPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(sanitized, null, 2)}\n`)
  return sanitized
}

export function portMatchesPreferences(port: number, preferences: PortWatchPreferences): boolean {
  return preferences.monitoredPortRanges.some((range) => {
    const lower = Math.min(range.lowerBound, range.upperBound)
    const upper = Math.max(range.lowerBound, range.upperBound)
    return port >= lower && port <= upper
  })
}

function preferencesPath(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

function sanitizePreferences(value: unknown): PortWatchPreferences {
  const input = value as Partial<PortWatchPreferences>
  const ranges = Array.isArray(input.monitoredPortRanges)
    ? input.monitoredPortRanges.map(sanitizeRange).filter(Boolean) as PortRange[]
    : []

  return {
    selectedRefreshProfile: input.selectedRefreshProfile === 'live' ? 'live' : 'normal',
    liveRefreshInterval: clampNumber(input.liveRefreshInterval, 0.5, 60, defaultPreferences.liveRefreshInterval),
    normalRefreshInterval: clampNumber(input.normalRefreshInterval, 1, 300, defaultPreferences.normalRefreshInterval),
    monitoredPortRanges: ranges.length > 0 ? ranges : defaultPreferences.monitoredPortRanges
  }
}

function sanitizeRange(value: unknown): PortRange | undefined {
  const range = value as Partial<PortRange>
  const lowerBound = clampInteger(range.lowerBound, 0, 65535, 0)
  const upperBound = clampInteger(range.upperBound, 0, 65535, 65535)

  return {
    id: typeof range.id === 'string' && range.id.length > 0 ? range.id : randomUUID(),
    lowerBound,
    upperBound
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback))
}
