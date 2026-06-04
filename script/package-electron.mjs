#!/usr/bin/env node
import { constants } from 'node:fs'
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { arch as hostArch, platform as hostPlatform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { packager } from '@electron/packager'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))

const appName = packageJson.productName ?? 'PortWatch'
const appId = 'com.doit.PortWatch'
const mode = process.argv[2] ?? 'app'
const targetPlatform = readOption('--platform') ?? defaultPlatform()
const targetArch = readOption('--arch') ?? defaultArch(targetPlatform)
const releaseChannel = process.env.PORTWATCH_CHANNEL

if (!['app', 'velopack'].includes(mode)) {
  fail('usage: node script/package-electron.mjs <app|velopack> [--platform=darwin|win32] [--arch=x64|arm64]')
}

if (!['darwin', 'win32'].includes(targetPlatform)) {
  fail(`Unsupported platform "${targetPlatform}". PortWatch currently packages darwin and win32 targets.`)
}

const appOutDir = join(rootDir, 'release', 'app')
const stageRootDir = join(rootDir, 'release', 'stage')
const velopackOutDir = join(rootDir, 'release', 'velopack', `${targetPlatform}-${targetArch}`)
const localVpkDll = join(rootDir, 'release', 'tools', 'vpk-1.2.0', 'tools', 'net8.0', 'any', 'vpk.dll')

if (targetPlatform === 'win32') {
  await ensureWindowsIcon()
}

const packagedPaths = mode === 'app'
  ? await packageElectronApp()
  : await findOrCreatePackagedApp()

const packagedPath = packagedPaths[0]
console.log(`Packaged app: ${packagedPath}`)

if (mode === 'velopack') {
  await packageVelopack(packagedPath)
}

async function packageElectronApp() {
  const stageDir = await prepareStageDir()
  const extraResource = await prepareExtraResources(stageDir)
  await mkdir(appOutDir, { recursive: true })

  return packager({
    dir: stageDir,
    name: appName,
    executableName: appName,
    platform: targetPlatform,
    arch: targetArch,
    out: appOutDir,
    overwrite: true,
    asar: false,
    appBundleId: appId,
    helperBundleId: `${appId}.helper`,
    appCategoryType: 'public.app-category.developer-tools',
    appVersion: packageJson.version,
    icon: targetPlatform === 'darwin'
      ? join(rootDir, 'Assets', 'AppIcon.icns')
      : join(rootDir, 'Assets', 'portwatch.ico'),
    extraResource,
    prune: false,
    win32metadata: {
      CompanyName: 'Doit',
      FileDescription: appName,
      ProductName: appName,
      InternalName: appName,
      OriginalFilename: `${appName}.exe`,
      'requested-execution-level': 'asInvoker'
    },
    extendInfo: {
      CFBundleDisplayName: appName,
      LSMinimumSystemVersion: '11.0'
    }
  })
}

async function prepareStageDir() {
  const stageDir = join(stageRootDir, `${targetPlatform}-${targetArch}`)
  await rm(stageDir, { recursive: true, force: true })
  await mkdir(join(stageDir, 'node_modules', '@neon-rs'), { recursive: true })

  const stagedPackageJson = {
    name: packageJson.name,
    productName: appName,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main,
    type: packageJson.type,
    dependencies: {
      velopack: packageJson.dependencies.velopack
    }
  }

  await writeFile(join(stageDir, 'package.json'), `${JSON.stringify(stagedPackageJson, null, 2)}\n`)
  await cp(join(rootDir, 'out'), join(stageDir, 'out'), { recursive: true })
  await cp(join(rootDir, 'node_modules', 'velopack'), join(stageDir, 'node_modules', 'velopack'), { recursive: true })
  await cp(join(rootDir, 'node_modules', '@neon-rs', 'load'), join(stageDir, 'node_modules', '@neon-rs', 'load'), { recursive: true })

  return stageDir
}

async function prepareExtraResources(stageDir) {
  const resources = [
    join(rootDir, 'Assets', 'portwatch-icon.png'),
    join(rootDir, 'Assets', 'menu-bar-icon.png')
  ]

  const generatedUpdateConfig = await prepareUpdateConfigResource(stageDir)
  if (generatedUpdateConfig) {
    resources.push(generatedUpdateConfig)
  }

  return resources
}

async function prepareUpdateConfigResource(stageDir) {
  const generatedPath = join(stageDir, 'portwatch-update.json')

  if (process.env.PORTWATCH_UPDATE_URL) {
    const config = {
      url: process.env.PORTWATCH_UPDATE_URL,
      ...(process.env.PORTWATCH_UPDATE_CHANNEL ? { channel: process.env.PORTWATCH_UPDATE_CHANNEL } : {})
    }
    await writeFile(generatedPath, `${JSON.stringify(config, null, 2)}\n`)
    return generatedPath
  }

  const assetConfigPath = join(rootDir, 'Assets', 'portwatch-update.json')
  try {
    await access(assetConfigPath, constants.R_OK)
    return assetConfigPath
  } catch {
    return undefined
  }
}

async function findOrCreatePackagedApp() {
  const expected = join(appOutDir, `${appName}-${targetPlatform}-${targetArch}`)
  try {
    await access(expected, constants.R_OK)
    return [expected]
  } catch {
    return packageElectronApp()
  }
}

async function packageVelopack(packagedPath) {
  const command = await resolveVelopackCommand()
  if (!command) {
    fail([
      'Velopack CLI `vpk` was not found in PATH.',
      'Install it with `dotnet tool install -g vpk`, install a .NET SDK with `dnx`, or run `npm run prepare:velopack` and set DOTNET_PATH to a .NET 8+ runtime.',
      'Docs: https://docs.velopack.io/packaging/overview'
    ].join('\n'))
  }

  await rm(velopackOutDir, { recursive: true, force: true })
  await mkdir(velopackOutDir, { recursive: true })

  const packDir = targetPlatform === 'darwin'
    ? join(packagedPath, `${appName}.app`)
    : packagedPath

  const mainExe = targetPlatform === 'darwin'
    ? appName
    : `${appName}.exe`

  const args = [
    'pack',
    '--packId', appId,
    '--packTitle', appName,
    '--packVersion', packageJson.version,
    '--runtime', velopackRuntime(),
    '--packDir', packDir,
    '--mainExe', mainExe,
    '--outputDir', velopackOutDir
  ]

  if (releaseChannel) {
    args.push('--channel', releaseChannel)
  }

  await run(command.executable, [...command.prefixArgs, ...velopackTargetDirective(), ...args])
  console.log(`Velopack output: ${velopackOutDir}`)
}

function velopackTargetDirective() {
  const currentPlatform = hostPlatform()

  if (targetPlatform === 'win32' && currentPlatform !== 'win32') {
    return ['[win]']
  }

  if (targetPlatform === 'darwin' && currentPlatform !== 'darwin') {
    return ['[osx]']
  }

  return []
}

function velopackRuntime() {
  if (targetPlatform === 'darwin') {
    return targetArch === 'x64' ? 'osx-x64' : 'osx-arm64'
  }

  if (targetPlatform === 'win32') {
    return targetArch === 'arm64' ? 'win-arm64' : 'win-x64'
  }

  return `${targetPlatform}-${targetArch}`
}

async function resolveVelopackCommand() {
  if (process.env.VPK_PATH) {
    return { executable: process.env.VPK_PATH, prefixArgs: [] }
  }

  const vpk = await findCommand('vpk')
  if (vpk) {
    return { executable: vpk, prefixArgs: [] }
  }

  const dnx = await findCommand('dnx')
  if (dnx) {
    return { executable: dnx, prefixArgs: ['vpk'] }
  }

  const dotnet = await resolveDotnetCommand()
  if (dotnet && await fileExists(localVpkDll)) {
    return { executable: dotnet, prefixArgs: [localVpkDll] }
  }

  return undefined
}

async function resolveDotnetCommand() {
  const candidates = [
    process.env.DOTNET_PATH,
    process.env.DOTNET_ROOT ? join(process.env.DOTNET_ROOT, hostPlatform() === 'win32' ? 'dotnet.exe' : 'dotnet') : undefined,
    '/opt/homebrew/opt/dotnet@8/libexec/dotnet',
    '/usr/local/opt/dotnet@8/libexec/dotnet',
    join(rootDir, 'release', 'tools', 'dotnet', hostPlatform() === 'win32' ? 'dotnet.exe' : 'dotnet'),
    await findCommand('dotnet')
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }

  return undefined
}

async function ensureWindowsIcon() {
  const iconPath = join(rootDir, 'Assets', 'portwatch.ico')
  try {
    await access(iconPath, constants.R_OK)
    return
  } catch {
    // Generate a single-size ICO that Electron Packager can embed in the Windows executable.
  }

  const ffmpeg = await findCommand('ffmpeg')
  if (!ffmpeg) {
    fail('Windows packaging needs Assets/portwatch.ico or ffmpeg available to generate it from Assets/portwatch-icon.png.')
  }

  await run(ffmpeg, [
    '-y',
    '-i', join(rootDir, 'Assets', 'portwatch-icon.png'),
    '-vf', 'scale=256:256',
    '-frames:v', '1',
    iconPath
  ])
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function defaultPlatform() {
  const current = hostPlatform()
  return current === 'win32' ? 'win32' : 'darwin'
}

function defaultArch(platform) {
  if (platform === 'win32') return 'x64'
  return hostArch() === 'arm64' ? 'arm64' : 'x64'
}

async function findCommand(command) {
  const lookup = hostPlatform() === 'win32' ? 'where' : '/bin/sh'
  const args = hostPlatform() === 'win32' ? [command] : ['-lc', `command -v ${shellEscape(command)}`]
  try {
    const result = await capture(lookup, args)
    return result.trim().split(/\r?\n/)[0] || undefined
  } catch {
    return undefined
  }
}

async function fileExists(path) {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    try {
      await access(path, constants.R_OK)
      return true
    } catch {
      return false
    }
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr || `${command} exited with ${code}`))
    })
  })
}

function shellEscape(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
