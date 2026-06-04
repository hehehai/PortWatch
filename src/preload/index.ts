import { contextBridge, ipcRenderer } from 'electron'
import type { PortRecord, PortWatchPreferences, UpdateStatus } from '../shared/types'

const api = {
  listPorts: (): Promise<PortRecord[]> => ipcRenderer.invoke('ports:list'),
  terminatePortProcess: (pid: number): Promise<void> => ipcRenderer.invoke('ports:terminate', pid),
  getPreferences: (): Promise<PortWatchPreferences> => ipcRenderer.invoke('preferences:get'),
  setPreferences: (preferences: PortWatchPreferences): Promise<PortWatchPreferences> => ipcRenderer.invoke('preferences:set', preferences),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:install'),
  onRefreshRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('ports:refresh-requested', listener)
    return () => ipcRenderer.removeListener('ports:refresh-requested', listener)
  },
  onUpdateCheckRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('updater:check-requested', listener)
    return () => ipcRenderer.removeListener('updater:check-requested', listener)
  }
}

contextBridge.exposeInMainWorld('portwatch', api)

export type PortWatchApi = typeof api
