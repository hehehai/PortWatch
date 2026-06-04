import type { PortRecord, PortWatchPreferences, UpdateStatus } from '../shared/types'

interface PortWatchApi {
  listPorts: () => Promise<PortRecord[]>
  terminatePortProcess: (pid: number) => Promise<void>
  getPreferences: () => Promise<PortWatchPreferences>
  setPreferences: (preferences: PortWatchPreferences) => Promise<PortWatchPreferences>
  checkForUpdates: () => Promise<UpdateStatus>
  installUpdate: () => Promise<UpdateStatus>
  onRefreshRequested: (callback: () => void) => () => void
  onUpdateCheckRequested: (callback: () => void) => () => void
}

declare global {
  interface Window {
    portwatch: PortWatchApi
  }
}
