import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { UpdateManager } from 'velopack'
import type { UpdateStatus } from '../../shared/types'

interface UpdateConfig {
  url?: string
  channel?: string
}

function unavailableStatus(message: string, currentVersion?: string): UpdateStatus {
  return {
    provider: 'velopack',
    available: false,
    currentVersion,
    message,
  }
}

function availableStatus(
  message: string,
  manager: UpdateManager,
  options: Pick<UpdateStatus, 'targetVersion' | 'pendingRestart'> = {},
): UpdateStatus {
  return {
    provider: 'velopack',
    available: true,
    currentVersion: safeCurrentVersion(manager),
    message,
    ...options,
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const manager = await createUpdateManager()
    if (!manager) {
      return unavailableStatus(
        'Configure PORTWATCH_UPDATE_URL or portwatch-update.json to enable Velopack update checks.',
      )
    }

    const pending = manager.getUpdatePendingRestart()
    if (pending) {
      return availableStatus(
        `Update ${pending.Version} is downloaded and ready to apply.`,
        manager,
        {
          targetVersion: pending.Version,
          pendingRestart: true,
        },
      )
    }

    const update = await manager.checkForUpdatesAsync()
    if (!update) {
      return unavailableStatus('No updates available.', safeCurrentVersion(manager))
    }

    return availableStatus(`Update available: ${update.TargetFullRelease.Version}`, manager, {
      targetVersion: update.TargetFullRelease.Version,
    })
  } catch (error) {
    return unavailableStatus(
      `Update check failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export async function downloadAndApplyUpdate(): Promise<UpdateStatus> {
  const manager = await createUpdateManager()
  if (!manager) {
    return unavailableStatus(
      'Configure PORTWATCH_UPDATE_URL or portwatch-update.json before installing updates.',
    )
  }

  const pending = manager.getUpdatePendingRestart()
  if (pending) {
    manager.waitExitThenApplyUpdate(pending, false, true)
    return availableStatus(`Applying update ${pending.Version}.`, manager, {
      targetVersion: pending.Version,
      pendingRestart: true,
    })
  }

  const update = await manager.checkForUpdatesAsync()
  if (!update) {
    return unavailableStatus('No updates available to install.', safeCurrentVersion(manager))
  }

  await manager.downloadUpdateAsync(update)
  manager.waitExitThenApplyUpdate(update, false, true)

  return availableStatus(
    `Downloaded update ${update.TargetFullRelease.Version}. PortWatch will restart to apply it.`,
    manager,
    {
      targetVersion: update.TargetFullRelease.Version,
      pendingRestart: true,
    },
  )
}

async function createUpdateManager(): Promise<UpdateManager | undefined> {
  const config = await loadUpdateConfig()
  if (!config.url) return undefined

  if (config.channel) {
    return new UpdateManager(config.url, {
      AllowVersionDowngrade: false,
      ExplicitChannel: config.channel,
      MaximumDeltasBeforeFallback: 10,
    })
  }

  return new UpdateManager(config.url)
}

async function loadUpdateConfig(): Promise<UpdateConfig> {
  if (process.env.PORTWATCH_UPDATE_URL) {
    return {
      url: process.env.PORTWATCH_UPDATE_URL,
      channel: process.env.PORTWATCH_UPDATE_CHANNEL ?? process.env.PORTWATCH_CHANNEL,
    }
  }

  const configs = await Promise.all(updateConfigPaths().map(readUpdateConfigFile))
  const config = configs.find((item) => item !== undefined)
  if (config) {
    return config
  }

  return {}
}

function updateConfigPaths(): string[] {
  const developmentResourcePath = join(app.getAppPath(), 'Assets', 'portwatch-update.json')
  const packagedResourcePath = join(process.resourcesPath, 'portwatch-update.json')

  return [
    join(app.getPath('userData'), 'portwatch-update.json'),
    app.isPackaged ? packagedResourcePath : developmentResourcePath,
  ]
}

function safeCurrentVersion(manager: UpdateManager): string | undefined {
  try {
    return manager.getCurrentVersion()
  } catch {
    return undefined
  }
}

async function readUpdateConfigFile(path: string): Promise<UpdateConfig | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as UpdateConfig
    return {
      url: typeof parsed.url === 'string' && parsed.url.length > 0 ? parsed.url : undefined,
      channel:
        typeof parsed.channel === 'string' && parsed.channel.length > 0
          ? parsed.channel
          : undefined,
    }
  } catch {
    // Missing or malformed config should not prevent the app from starting.
    return undefined
  }
}
