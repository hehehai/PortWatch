import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { VelopackApp } from 'velopack'
import { fetchListeningPorts } from './services/port-inspector'
import { loadPreferences, portMatchesPreferences, savePreferences } from './services/preferences'
import { terminateProcess } from './services/process-manager'
import { checkForUpdates, downloadAndApplyUpdate } from './services/updater'
import type { PortWatchPreferences } from '../shared/types'

VelopackApp.build().run()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let latestPortCount = 0

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 560,
    minWidth: 360,
    minHeight: 560,
    title: 'PortWatch',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 24 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  attachWindowDiagnostics(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

function updateTrayMenu(): void {
  if (!tray) return

  const countLabel = `${latestPortCount} listening ${latestPortCount === 1 ? 'port' : 'ports'}`
  tray.setToolTip(`PortWatch - ${countLabel}`)
  if (process.platform === 'darwin') {
    tray.setTitle('')
  }

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'PortWatch', enabled: false },
    { label: countLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open App', click: showMainWindow },
    {
      label: 'Refresh Ports',
      click: () => {
        showMainWindow()
        mainWindow?.webContents.send('ports:refresh-requested')
      }
    },
    {
      label: 'Check Updates',
      click: () => {
        showMainWindow()
        mainWindow?.webContents.send('updater:check-requested')
      }
    },
    { type: 'separator' },
    {
      label: process.platform === 'darwin' ? 'Quit PortWatch' : 'Quit',
      click: () => app.quit()
    }
  ]))
}

async function fetchPortsAndUpdateTray() {
  const preferences = await loadPreferences()
  const records = (await fetchListeningPorts())
    .filter((record) => portMatchesPreferences(record.port, preferences))
  latestPortCount = records.length
  updateTrayMenu()
  return records
}

app.whenReady().then(() => {
  ipcMain.handle('ports:list', () => fetchPortsAndUpdateTray())
  ipcMain.handle('ports:terminate', (_event, pid: number) => terminateProcess(pid))
  ipcMain.handle('preferences:get', () => loadPreferences())
  ipcMain.handle('preferences:set', async (_event, preferences: PortWatchPreferences) => {
    const saved = await savePreferences(preferences)
    void fetchPortsAndUpdateTray().catch((error) => {
      console.error(`[preferences] failed to refresh filtered port count: ${error instanceof Error ? error.message : String(error)}`)
    })
    return saved
  })
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:install', async () => {
    const result = await downloadAndApplyUpdate()
    if (result.available) {
      setTimeout(() => app.quit(), 500)
    }
    return result
  })

  createWindow()
  createTray()
  void fetchPortsAndUpdateTray().catch((error) => {
    console.error(`[tray] failed to refresh port count: ${error instanceof Error ? error.message : String(error)}`)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
