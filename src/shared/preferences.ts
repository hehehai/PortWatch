import type { PortRange, PortWatchPreferences } from './types'

export function createDefaultMonitoredPortRanges(): PortRange[] {
  return [{ id: 'default', lowerBound: 0, upperBound: 65535 }]
}

export function createDefaultPreferences(): PortWatchPreferences {
  return {
    selectedRefreshProfile: 'normal',
    liveRefreshInterval: 1,
    normalRefreshInterval: 5,
    monitoredPortRanges: createDefaultMonitoredPortRanges(),
    starredPorts: [],
  }
}

export function getPortRangeBounds(range: Pick<PortRange, 'lowerBound' | 'upperBound'>): {
  lowerBound: number
  upperBound: number
} {
  return {
    lowerBound: Math.min(range.lowerBound, range.upperBound),
    upperBound: Math.max(range.lowerBound, range.upperBound),
  }
}

export function formatPortRange(range: Pick<PortRange, 'lowerBound' | 'upperBound'>): string {
  const { lowerBound, upperBound } = getPortRangeBounds(range)
  return `${lowerBound}-${upperBound}`
}
