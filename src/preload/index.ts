import { contextBridge, ipcRenderer } from 'electron'
import type { PortRecord, PortWatchPreferences, UpdateStatus, WindowState } from '../shared/types'

function subscribe(channel: string, callback: () => void): () => void {
  const listener = (): void => callback()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function subscribeWithPayload<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  listPorts: (): Promise<PortRecord[]> => ipcRenderer.invoke('ports:list'),
  terminatePortProcess: (pid: number): Promise<void> => ipcRenderer.invoke('ports:terminate', pid),
  getPreferences: (): Promise<PortWatchPreferences> => ipcRenderer.invoke('preferences:get'),
  setPreferences: (preferences: PortWatchPreferences): Promise<PortWatchPreferences> =>
    ipcRenderer.invoke('preferences:set', preferences),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:install'),
  getWindowState: (): Promise<WindowState> => ipcRenderer.invoke('window:get-state'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  toggleFullScreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-full-screen'),
  onRefreshRequested: (callback: () => void): (() => void) =>
    subscribe('ports:refresh-requested', callback),
  onUpdateCheckRequested: (callback: () => void): (() => void) =>
    subscribe('updater:check-requested', callback),
  onWindowStateChanged: (callback: (state: WindowState) => void): (() => void) =>
    subscribeWithPayload('window:state-changed', callback),
}

contextBridge.exposeInMainWorld('portwatch', api)

export type PortWatchApi = typeof api
