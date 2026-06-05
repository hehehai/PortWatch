import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron'
import { join } from 'node:path'
import { VelopackApp } from 'velopack'
import { getMacTrafficLightPosition } from '../shared/desktopChrome'
import { fetchListeningPorts } from './services/port-inspector'
import { loadPreferences, portMatchesPreferences, savePreferences } from './services/preferences'
import { terminateProcess } from './services/process-manager'
import { checkForUpdates, downloadAndApplyUpdate } from './services/updater'
import type { PortWatchPreferences, WindowState } from '../shared/types'

VelopackApp.build().run()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let latestPortCount = 0
let hasObservedPortSnapshot = false
let observedPortIds = new Set<string>()
const activeNotifications = new Set<Notification>()
const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 360,
    height: 560,
    minWidth: 360,
    minHeight: 560,
    title: 'PortWatch',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? getMacTrafficLightPosition() : undefined,
    ...getWindowMaterialOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isMac) {
    mainWindow.setWindowButtonVisibility(true)
  }

  attachWindowDiagnostics(mainWindow)
  attachWindowStateBridge(mainWindow)

  if (isDevelopment) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (!rendererUrl) {
      throw new Error('ELECTRON_RENDERER_URL is required in development mode.')
    }
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (isDevelopment) {
    mainWindow.webContents.once('did-frame-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    })
  }
}

function getWindowMaterialOptions(): Electron.BrowserWindowConstructorOptions {
  if (process.platform !== 'darwin') {
    return { backgroundColor: '#f6f4ee' }
  }

  return {
    vibrancy: 'under-window',
    visualEffectState: 'followWindow',
    transparent: true,
    backgroundColor: '#00000000',
  }
}

function buildWindowState(window: BrowserWindow): WindowState {
  return {
    isFullScreen: window.isFullScreen(),
    platform: process.platform,
  }
}

function defaultWindowState(): WindowState {
  return {
    isFullScreen: false,
    platform: process.platform,
  }
}

function emitWindowState(window: BrowserWindow): void {
  window.webContents.send('window:state-changed', buildWindowState(window))
}

function attachWindowStateBridge(window: BrowserWindow): void {
  window.on('enter-full-screen', () => emitWindowState(window))
  window.on('leave-full-screen', () => emitWindowState(window))
}

function attachWindowDiagnostics(window: BrowserWindow): void {
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`)
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload] ${preloadPath}: ${error.message}`)
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer] process gone: ${details.reason} (${details.exitCode})`)
  })

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })
}

function createTray(): void {
  const imageName = process.platform === 'darwin' ? 'menu-bar-icon.png' : 'portwatch-icon.png'
  let image = nativeImage.createFromPath(resolveResourcePath(imageName))

  if (process.platform === 'darwin') {
    image = image.resize({ width: 17, height: 17 })
    image.setTemplateImage(true)
  } else {
    image = image.resize({ width: 16, height: 16 })
  }

  tray = new Tray(image)
  tray.on('click', showMainWindow)
  updateTrayMenu()
}

function resolveResourcePath(fileName: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, fileName)
    : join(app.getAppPath(), 'Assets', fileName)
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
  }

  mainWindow?.show()
  mainWindow?.focus()
}

function showWindowAndSend(channel: string): void {
  showMainWindow()
  mainWindow?.webContents.send(channel)
}

function getWindowFromSender(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

function updateTrayMenu(): void {
  if (!tray) return

  const countLabel = `${latestPortCount} listening ${latestPortCount === 1 ? 'port' : 'ports'}`
  tray.setToolTip(`PortWatch - ${countLabel}`)
  if (process.platform === 'darwin') {
    tray.setTitle('')
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'PortWatch', enabled: false },
      { label: countLabel, enabled: false },
      { type: 'separator' },
      { label: 'Open App', click: showMainWindow },
      {
        label: 'Refresh Ports',
        click: () => showWindowAndSend('ports:refresh-requested'),
      },
      {
        label: 'Check Updates',
        click: () => showWindowAndSend('updater:check-requested'),
      },
      { type: 'separator' },
      {
        label: process.platform === 'darwin' ? 'Quit PortWatch' : 'Quit',
        click: () => app.quit(),
      },
    ]),
  )
}

function notifyAboutNewPorts(records: ReturnType<typeof filterNewPortRecords>): void {
  if (records.length === 0) {
    return
  }

  if (!Notification.isSupported()) {
    console.warn(
      `[notifications] unsupported on this system, skipped for ports: ${records.map((record) => record.port).join(', ')}`,
    )
    return
  }

  const title =
    records.length === 1 ? 'New listening port detected' : 'New listening ports detected'
  const portSummary = records
    .slice(0, 3)
    .map((record) => `${record.port} (${record.command})`)
    .join(', ')
  const extraCount = records.length - 3
  const body = extraCount > 0 ? `${portSummary}, +${extraCount} more` : portSummary

  const notification = new Notification({
    title,
    body,
    silent: false,
  })
  activeNotifications.add(notification)

  notification.on('click', () => showMainWindow())
  notification.on('show', () => {
    console.log(
      `[notifications] shown for ports: ${records.map((record) => record.port).join(', ')}`,
    )
  })
  notification.on('close', () => {
    activeNotifications.delete(notification)
  })
  notification.show()
}

function filterNewPortRecords(records: Awaited<ReturnType<typeof fetchListeningPorts>>) {
  return records.filter((record) => !observedPortIds.has(record.id))
}

async function fetchPortsAndUpdateTray(options?: { suppressNotifications?: boolean }) {
  const preferences = await loadPreferences()
  const records = (await fetchListeningPorts()).filter((record) =>
    portMatchesPreferences(record.port, preferences),
  )
  const newRecords =
    hasObservedPortSnapshot && !options?.suppressNotifications ? filterNewPortRecords(records) : []

  latestPortCount = records.length
  observedPortIds = new Set(records.map((record) => record.id))
  hasObservedPortSnapshot = true
  updateTrayMenu()
  notifyAboutNewPorts(newRecords)
  return records
}

app.whenReady().then(() => {
  ipcMain.handle('ports:list', () => fetchPortsAndUpdateTray())
  ipcMain.handle('ports:terminate', (_event, pid: number) => terminateProcess(pid))
  ipcMain.handle('preferences:get', () => loadPreferences())
  ipcMain.handle('preferences:set', async (_event, preferences: PortWatchPreferences) => {
    const saved = await savePreferences(preferences)
    void fetchPortsAndUpdateTray({ suppressNotifications: true }).catch((error) => {
      console.error(
        `[preferences] failed to refresh filtered port count: ${error instanceof Error ? error.message : String(error)}`,
      )
    })
    return saved
  })
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:install', async () => {
    const result = await downloadAndApplyUpdate()
    if (result.pendingRestart) {
      setTimeout(() => app.quit(), 500)
    }
    return result
  })
  ipcMain.handle('window:get-state', (event) => {
    const window = getWindowFromSender(event)
    return window ? buildWindowState(window) : defaultWindowState()
  })
  ipcMain.handle('window:minimize', (event) => {
    getWindowFromSender(event)?.minimize()
  })
  ipcMain.handle('window:close', (event) => {
    getWindowFromSender(event)?.close()
  })
  ipcMain.handle('window:toggle-full-screen', (event) => {
    const window = getWindowFromSender(event)
    if (!window) {
      return false
    }
    window.setFullScreen(!window.isFullScreen())
    return window.isFullScreen()
  })

  createWindow()
  createTray()
  void fetchPortsAndUpdateTray().catch((error) => {
    console.error(
      `[tray] failed to refresh port count: ${error instanceof Error ? error.message : String(error)}`,
    )
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
