import type { UpdateStatus } from '../types'
import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { UpdateManager } from 'velopack'

interface UpdateConfig {
  url?: string
  channel?: string
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const manager = await createUpdateManager()
    if (!manager) {
      return {
        provider: 'velopack',
        available: false,
        message: 'Configure PORTWATCH_UPDATE_URL or portwatch-update.json to enable Velopack update checks.'
      }
    }

    const pending = manager.getUpdatePendingRestart()
    if (pending) {
      return {
        provider: 'velopack',
        available: true,
        pendingRestart: true,
        currentVersion: safeCurrentVersion(manager),
        targetVersion: pending.Version,
        message: `Update ${pending.Version} is downloaded and ready to apply.`
      }
    }

    const update = await manager.checkForUpdatesAsync()
    if (!update) {
      return {
        provider: 'velopack',
        available: false,
        currentVersion: safeCurrentVersion(manager),
        message: 'No updates available.'
      }
    }

    return {
      provider: 'velopack',
      available: true,
      currentVersion: safeCurrentVersion(manager),
      targetVersion: update.TargetFullRelease.Version,
      message: `Update available: ${update.TargetFullRelease.Version}`
    }
  } catch (error) {
    return {
      provider: 'velopack',
      available: false,
      message: `Update check failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

export async function downloadAndApplyUpdate(): Promise<UpdateStatus> {
  const manager = await createUpdateManager()
  if (!manager) {
    return {
      provider: 'velopack',
      available: false,
      message: 'Configure PORTWATCH_UPDATE_URL or portwatch-update.json before installing updates.'
    }
  }

  const pending = manager.getUpdatePendingRestart()
  if (pending) {
    manager.waitExitThenApplyUpdate(pending, false, true)
    return {
      provider: 'velopack',
      available: true,
      pendingRestart: true,
      currentVersion: safeCurrentVersion(manager),
      targetVersion: pending.Version,
      message: `Applying update ${pending.Version}.`
    }
  }

  const update = await manager.checkForUpdatesAsync()
  if (!update) {
    return {
      provider: 'velopack',
      available: false,
      currentVersion: safeCurrentVersion(manager),
      message: 'No updates available to install.'
    }
  }

  await manager.downloadUpdateAsync(update)
  manager.waitExitThenApplyUpdate(update, false, true)

  return {
    provider: 'velopack',
    available: true,
    pendingRestart: true,
    currentVersion: safeCurrentVersion(manager),
    targetVersion: update.TargetFullRelease.Version,
    message: `Downloaded update ${update.TargetFullRelease.Version}. PortWatch will restart to apply it.`
  }
}

async function createUpdateManager(): Promise<UpdateManager | undefined> {
  const config = await loadUpdateConfig()
  if (!config.url) return undefined

  if (config.channel) {
    return new UpdateManager(config.url, {
      AllowVersionDowngrade: false,
      ExplicitChannel: config.channel,
      MaximumDeltasBeforeFallback: 10
    })
  }

  return new UpdateManager(config.url)
}

async function loadUpdateConfig(): Promise<UpdateConfig> {
  if (process.env.PORTWATCH_UPDATE_URL) {
    return {
      url: process.env.PORTWATCH_UPDATE_URL,
      channel: process.env.PORTWATCH_UPDATE_CHANNEL
    }
  }

  for (const path of updateConfigPaths()) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as UpdateConfig
      return {
        url: typeof parsed.url === 'string' && parsed.url.length > 0 ? parsed.url : undefined,
        channel: typeof parsed.channel === 'string' && parsed.channel.length > 0 ? parsed.channel : undefined
      }
    } catch {
      // Missing or malformed config should not prevent the app from starting.
    }
  }

  return {}
}

function updateConfigPaths(): string[] {
  const developmentResourcePath = join(app.getAppPath(), 'Assets', 'portwatch-update.json')
  const packagedResourcePath = join(process.resourcesPath, 'portwatch-update.json')

  return [
    join(app.getPath('userData'), 'portwatch-update.json'),
    app.isPackaged ? packagedResourcePath : developmentResourcePath
  ]
}

function safeCurrentVersion(manager: UpdateManager): string | undefined {
  try {
    return manager.getCurrentVersion()
  } catch {
    return undefined
  }
}
