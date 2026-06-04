export interface PortRecord {
  id: string
  pid: number
  command: string
  user?: string
  endpoint: string
  address: string
  port: number
  protocolName: string
  state: string
  workingDirectory?: string
  executablePath?: string
  source?: string
  startedAt?: string
  uptime?: number
  launchedBy?: string
  launchChain: string[]
}

export interface UpdateStatus {
  provider: 'velopack'
  available: boolean
  message: string
  currentVersion?: string
  targetVersion?: string
  pendingRestart?: boolean
}

export type RefreshProfile = 'live' | 'normal'

export interface PortRange {
  id: string
  lowerBound: number
  upperBound: number
}

export interface PortWatchPreferences {
  selectedRefreshProfile: RefreshProfile
  liveRefreshInterval: number
  normalRefreshInterval: number
  monitoredPortRanges: PortRange[]
}
