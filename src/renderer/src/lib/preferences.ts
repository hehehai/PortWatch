import type { PortRange } from '../types'
import { formatPortRange } from '../../../shared/preferences'

export {
  createDefaultMonitoredPortRanges,
  createDefaultPreferences,
} from '../../../shared/preferences'

export type IntervalKey = 'liveRefreshInterval' | 'normalRefreshInterval'
export type PortRangeKey = 'lowerBound' | 'upperBound'

export interface IntervalUpdate {
  key: IntervalKey
  value: number | undefined
}

export interface PortRangeUpdate {
  id: string
  key: PortRangeKey
  value: number | undefined
}

export function describePortRange(range: PortRange): string {
  return formatPortRange(range)
}
