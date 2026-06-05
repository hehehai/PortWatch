import type { PortRecord, PortWatchPreferences, UpdateStatus, WindowState } from '../shared/types'

interface PortWatchApi {
  listPorts: () => Promise<PortRecord[]>
  terminatePortProcess: (pid: number) => Promise<void>
  getPreferences: () => Promise<PortWatchPreferences>
  setPreferences: (preferences: PortWatchPreferences) => Promise<PortWatchPreferences>
  checkForUpdates: () => Promise<UpdateStatus>
  installUpdate: () => Promise<UpdateStatus>
  getWindowState: () => Promise<WindowState>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  toggleFullScreen: () => Promise<boolean>
  onRefreshRequested: (callback: () => void) => () => void
  onUpdateCheckRequested: (callback: () => void) => () => void
  onWindowStateChanged: (callback: (state: WindowState) => void) => () => void
}

declare global {
  interface Window {
    portwatch: PortWatchApi
  }
}
