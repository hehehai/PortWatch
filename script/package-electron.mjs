#!/usr/bin/env node
import { constants } from 'node:fs'
import {
  access,
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { arch as hostArch, platform as hostPlatform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const requireFromRoot = createRequire(join(rootDir, 'package.json'))
const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
const currentHostPlatform = hostPlatform()
const currentHostArch = hostArch()

const appName = packageJson.productName ?? 'PortWatch'
const appId = 'com.doit.PortWatch'
const mode = process.argv[2] ?? 'app'
const targetPlatform = readOption('--platform') ?? defaultPlatform()
const targetArch = readOption('--arch') ?? defaultArch(targetPlatform)
const releaseChannel = process.env.PORTWATCH_CHANNEL ?? process.env.PORTWATCH_UPDATE_CHANNEL
const isTargetDarwin = targetPlatform === 'darwin'
const isTargetWindows = targetPlatform === 'win32'
const dotnetExecutableName = currentHostPlatform === 'win32' ? 'dotnet.exe' : 'dotnet'
const electronIconPath = join(rootDir, 'Assets', isTargetDarwin ? 'AppIcon.icns' : 'portwatch.ico')

if (!['app', 'velopack'].includes(mode)) {
  fail(
    'usage: node script/package-electron.mjs <app|velopack> [--platform=darwin|win32] [--arch=x64|arm64]',
  )
}

if (!['darwin', 'win32'].includes(targetPlatform)) {
  fail(
    `Unsupported platform "${targetPlatform}". PortWatch currently packages darwin and win32 targets.`,
  )
}

const appOutDir = join(rootDir, 'release', 'app')
const stageRootDir = join(rootDir, 'release', 'stage')
const velopackOutDir = join(rootDir, 'release', 'velopack', `${targetPlatform}-${targetArch}`)
const localVpkDll = join(
  rootDir,
  'release',
  'tools',
  'vpk-1.2.0',
  'tools',
  'net8.0',
  'any',
  'vpk.dll',
)

if (isTargetWindows) {
  await ensureWindowsIcon()
}

const packagedPaths = mode === 'app' ? await packageElectronApp() : await findOrCreatePackagedApp()

const packagedPath = packagedPaths[0]
console.log(`Packaged app: ${packagedPath}`)

if (mode === 'velopack') {
  await packageVelopack(packagedPath)
}

async function packageElectronApp() {
  const stageDir = await prepareStageDir()
  const extraResource = await prepareExtraResources(stageDir)
  await mkdir(appOutDir, { recursive: true })

  return packageElectronAppWithCli(stageDir, extraResource)
}

async function packageElectronAppWithCli(stageDir, extraResource) {
  const args = [
    join(rootDir, 'node_modules', '@electron', 'packager', 'bin', 'electron-packager.mjs'),
    stageDir,
    appName,
    `--platform=${targetPlatform}`,
    `--arch=${targetArch}`,
    `--out=${appOutDir}`,
    '--overwrite',
    '--no-asar',
    '--no-prune',
    `--electron-version=${normalizePackageVersion(packageJson.devDependencies.electron)}`,
    `--executable-name=${appName}`,
    `--app-version=${packageJson.version}`,
    `--icon=${electronIconPath}`,
  ]

  if (isTargetDarwin) {
    args.push(
      `--app-bundle-id=${appId}`,
      `--helper-bundle-id=${appId}.helper`,
      '--app-category-type=public.app-category.developer-tools',
      `--extend-info=${await prepareDarwinExtendInfo(stageDir)}`,
    )
  }

  if (isTargetWindows) {
    args.push(
      '--win32metadata.CompanyName=Doit',
      `--win32metadata.FileDescription=${appName}`,
      `--win32metadata.ProductName=${appName}`,
      `--win32metadata.InternalName=${appName}`,
      `--win32metadata.OriginalFilename=${appName}.exe`,
      '--win32metadata.requested-execution-level=asInvoker',
    )
  }

  args.push(...buildPackagerSigningArgs())

  for (const resource of extraResource) {
    args.push(`--extra-resource=${resource}`)
  }

  await run(process.execPath, args)
  const outputDir = join(appOutDir, `${appName}-${targetPlatform}-${targetArch}`)
  await normalizePackagedApp(outputDir)
  return [outputDir]
}

async function prepareDarwinExtendInfo(stageDir) {
  const path = join(stageDir, 'ExtendInfo.plist')
  await writeFile(
    path,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${appName}</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
`,
  )
  return path
}

async function prepareStageDir() {
  const stageDir = join(stageRootDir, `${targetPlatform}-${targetArch}`)
  await rm(stageDir, { recursive: true, force: true })
  await mkdir(join(stageDir, 'node_modules'), { recursive: true })

  const runtimeDependencies = pickDependencies(['electron-store', 'velopack'])

  const stagedPackageJson = {
    name: packageJson.name,
    productName: appName,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main,
    type: packageJson.type,
    dependencies: runtimeDependencies,
  }

  await writeFile(join(stageDir, 'package.json'), `${JSON.stringify(stagedPackageJson, null, 2)}\n`)
  await cp(join(rootDir, 'out'), join(stageDir, 'out'), { recursive: true })
  const copiedPackages = new Set()
  for (const dependencyName of Object.keys(runtimeDependencies)) {
    await copyRuntimePackage(
      dependencyName,
      requireFromRoot,
      join(stageDir, 'node_modules'),
      copiedPackages,
      join(rootDir, 'node_modules'),
    )
  }

  return stageDir
}

function pickDependencies(names) {
  return Object.fromEntries(
    names.map((name) => {
      const version = packageJson.dependencies?.[name]
      if (!version) {
        fail(`Missing runtime dependency "${name}" in package.json`)
      }
      return [name, version]
    }),
  )
}

async function copyRuntimePackage(
  name,
  requireFn,
  nodeModulesDir,
  copiedPackages,
  searchModulesDir,
) {
  if (copiedPackages.has(name)) {
    return
  }

  copiedPackages.add(name)
  const packageRoot = await resolvePackageRoot(name, requireFn, searchModulesDir)
  const packageJsonPath = join(packageRoot, 'package.json')
  const packageManifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  const destination = join(nodeModulesDir, ...name.split('/'))

  await mkdir(dirname(destination), { recursive: true })
  await cp(packageRoot, destination, { recursive: true })

  const requireFromPackage = createRequire(packageJsonPath)
  const dependencySearchModulesDir = dirname(packageRoot)
  const dependencyNames = [
    ...Object.keys(packageManifest.dependencies ?? {}),
    ...Object.keys(packageManifest.optionalDependencies ?? {}),
  ]

  for (const dependencyName of dependencyNames) {
    await copyRuntimePackage(
      dependencyName,
      requireFromPackage,
      nodeModulesDir,
      copiedPackages,
      dependencySearchModulesDir,
    )
  }
}

async function resolvePackageRoot(name, requireFn, searchModulesDir) {
  const packageRootFromNodeModules = await findPackageRootInNodeModules(name, searchModulesDir)
  if (packageRootFromNodeModules) {
    return packageRootFromNodeModules
  }

  const candidatePaths = requireFn.resolve.paths(name) ?? []
  for (const candidatePath of candidatePaths) {
    const packageJsonPath = join(candidatePath, ...name.split('/'), 'package.json')
    if (await fileExists(packageJsonPath)) {
      return realpath(dirname(packageJsonPath))
    }
  }

  let currentDir
  try {
    currentDir = dirname(requireFn.resolve(name))
  } catch {
    fail(`Could not resolve package root for "${name}".`)
  }

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json')
    try {
      const packageManifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
      if (packageManifest.name === name) {
        return realpath(currentDir)
      }
    } catch {
      // Keep walking until we find the package boundary.
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }

  fail(`Could not resolve package root for "${name}".`)
}

async function findPackageRootInNodeModules(name, startModulesDir) {
  let currentModulesDir = startModulesDir

  while (currentModulesDir) {
    const packageJsonPath = join(currentModulesDir, ...name.split('/'), 'package.json')
    if (await fileExists(packageJsonPath)) {
      return realpath(dirname(packageJsonPath))
    }

    const nextModulesDir = join(dirname(dirname(currentModulesDir)), 'node_modules')
    if (nextModulesDir === currentModulesDir) {
      break
    }
    currentModulesDir = nextModulesDir
  }

  return undefined
}

async function prepareExtraResources(stageDir) {
  const resources = [
    join(rootDir, 'Assets', 'portwatch-icon.png'),
    join(rootDir, 'Assets', 'menu-bar-icon.png'),
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
      ...(process.env.PORTWATCH_UPDATE_CHANNEL
        ? { channel: process.env.PORTWATCH_UPDATE_CHANNEL }
        : {}),
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
    await normalizePackagedApp(expected)
    return [expected]
  } catch {
    return packageElectronApp()
  }
}

async function normalizePackagedApp(appPath) {
  if (isTargetDarwin) {
    const appBundle = join(appPath, `${appName}.app`)
    const macosDir = join(appBundle, 'Contents', 'MacOS')
    const desiredExecutable = join(macosDir, appName)
    await ensureNamedExecutable(macosDir, desiredExecutable)
    await chmod(desiredExecutable, 0o755)
    console.log(`Electron main executable: ${desiredExecutable}`)
    return
  }

  if (isTargetWindows) {
    const desiredExecutable = join(appPath, `${appName}.exe`)
    await ensureNamedExecutable(appPath, desiredExecutable, '.exe')
    console.log(`Electron main executable: ${desiredExecutable}`)
  }
}

async function ensureNamedExecutable(directory, desiredExecutable, extension) {
  try {
    await access(desiredExecutable, constants.R_OK)
    return
  } catch {
    // Electron Packager can vary executable names by host/shell path handling.
  }

  const entries = await readdir(directory)
  const candidates = extension
    ? entries.filter((entry) => entry.toLowerCase().endsWith(extension))
    : entries

  if (candidates.length === 1) {
    await rename(join(directory, candidates[0]), desiredExecutable)
    return
  }

  fail(
    `Could not locate Electron executable in ${directory}. Entries: ${entries.join(', ') || '(empty)'}`,
  )
}

async function packageVelopack(appPath) {
  const command = await resolveVelopackCommand()
  if (!command) {
    fail(
      [
        'Velopack CLI `vpk` was not found in PATH.',
        'Install it with `dotnet tool install -g vpk`, install a .NET SDK with `dnx`, or run `pnpm run prepare:velopack` and set DOTNET_PATH to a .NET 8+ runtime.',
        'Docs: https://docs.velopack.io/packaging/overview',
      ].join('\n'),
    )
  }

  await rm(velopackOutDir, { recursive: true, force: true })
  await mkdir(velopackOutDir, { recursive: true })

  const packDir = isTargetDarwin ? join(appPath, `${appName}.app`) : appPath
  const mainExe = isTargetDarwin ? appName : `${appName}.exe`

  await assertMainExecutable(packDir, mainExe)

  const args = [
    'pack',
    '--packId',
    appId,
    '--packTitle',
    appName,
    '--packVersion',
    packageJson.version,
    '--runtime',
    velopackRuntime(),
    '--packDir',
    packDir,
    '--mainExe',
    mainExe,
    '--outputDir',
    velopackOutDir,
  ]

  if (releaseChannel) {
    args.push('--channel', releaseChannel)
  }

  console.log(`Velopack command: ${command.label}`)
  await run(command.executable, [...command.prefixArgs, ...velopackTargetDirective(), ...args])
  console.log(`Velopack output: ${velopackOutDir}`)
}

async function assertMainExecutable(packDir, mainExe) {
  const expectedPath = isTargetDarwin
    ? join(packDir, 'Contents', 'MacOS', mainExe)
    : join(packDir, mainExe)

  try {
    await access(expectedPath, isTargetDarwin ? constants.X_OK : constants.R_OK)
  } catch {
    fail(`Packaged app is missing Velopack main executable: ${expectedPath}`)
  }
}

function velopackTargetDirective() {
  if (isTargetWindows && currentHostPlatform !== 'win32') {
    return ['[win]']
  }

  if (isTargetDarwin && currentHostPlatform !== 'darwin') {
    return ['[osx]']
  }

  return []
}

function velopackRuntime() {
  if (isTargetDarwin) {
    return targetArch === 'x64' ? 'osx-x64' : 'osx-arm64'
  }

  if (isTargetWindows) {
    return targetArch === 'arm64' ? 'win-arm64' : 'win-x64'
  }

  return `${targetPlatform}-${targetArch}`
}

function buildPackagerSigningArgs() {
  if (isTargetDarwin) {
    return buildMacSigningArgs()
  }

  if (isTargetWindows) {
    return buildWindowsSigningArgs()
  }

  return []
}

function buildMacSigningArgs() {
  const args = []
  const identity = process.env.PORTWATCH_APPLE_SIGN_IDENTITY
  const keychain = process.env.PORTWATCH_APPLE_KEYCHAIN
  const apiKeyPath = process.env.PORTWATCH_APPLE_NOTARY_API_KEY_PATH
  const apiKeyId = process.env.PORTWATCH_APPLE_NOTARY_API_KEY_ID
  const apiIssuer = process.env.PORTWATCH_APPLE_NOTARY_API_ISSUER
  const appleId = process.env.PORTWATCH_APPLE_ID
  const appleIdPassword = process.env.PORTWATCH_APPLE_ID_PASSWORD
  const teamId = process.env.PORTWATCH_APPLE_TEAM_ID

  const hasNotaryApiKey = Boolean(apiKeyPath || apiKeyId || apiIssuer)
  const hasNotaryAppleId = Boolean(appleId || appleIdPassword || teamId)
  const shouldSign = Boolean(identity || keychain || hasNotaryApiKey || hasNotaryAppleId)

  if (!shouldSign) {
    return args
  }

  args.push('--osx-sign=true')

  if (identity) {
    args.push(`--osx-sign.identity=${identity}`)
  }

  if (keychain) {
    args.push(`--osx-sign.keychain=${keychain}`)
  }

  if (hasNotaryApiKey) {
    if (!apiKeyPath || !apiKeyId) {
      fail(
        'macOS notarization via App Store Connect API key requires PORTWATCH_APPLE_NOTARY_API_KEY_PATH and PORTWATCH_APPLE_NOTARY_API_KEY_ID.',
      )
    }
    args.push(`--osx-notarize.appleApiKey=${apiKeyPath}`)
    args.push(`--osx-notarize.appleApiKeyId=${apiKeyId}`)
    if (apiIssuer) {
      args.push(`--osx-notarize.appleApiIssuer=${apiIssuer}`)
    }
  } else if (hasNotaryAppleId) {
    if (!appleId || !appleIdPassword || !teamId) {
      fail(
        'macOS notarization via Apple ID requires PORTWATCH_APPLE_ID, PORTWATCH_APPLE_ID_PASSWORD, and PORTWATCH_APPLE_TEAM_ID.',
      )
    }
    args.push(`--osx-notarize.appleId=${appleId}`)
    args.push(`--osx-notarize.appleIdPassword=${appleIdPassword}`)
    args.push(`--osx-notarize.teamId=${teamId}`)
  }

  return args
}

function buildWindowsSigningArgs() {
  if (
    !process.env.WINDOWS_CERTIFICATE_FILE &&
    !process.env.WINDOWS_SIGN_WITH_PARAMS &&
    !process.env.WINDOWS_SIGNTOOL_PATH
  ) {
    return []
  }

  return ['--windows-sign=true']
}

async function resolveVelopackCommand() {
  if (process.env.VPK_PATH) {
    return { executable: process.env.VPK_PATH, prefixArgs: [], label: process.env.VPK_PATH }
  }

  const vpk = await findCommand('vpk')
  if (vpk) {
    return { executable: vpk, prefixArgs: [], label: vpk }
  }

  const dotnet = await resolveDotnetCommand()
  if (dotnet && (await fileExists(localVpkDll))) {
    return { executable: dotnet, prefixArgs: [localVpkDll], label: `${dotnet} ${localVpkDll}` }
  }

  const dnx = await findCommand('dnx')
  if (dnx) {
    return { executable: dnx, prefixArgs: ['vpk'], label: `${dnx} vpk` }
  }

  return undefined
}

async function resolveDotnetCommand() {
  const candidates = [
    process.env.DOTNET_PATH,
    process.env.DOTNET_ROOT ? join(process.env.DOTNET_ROOT, dotnetExecutableName) : undefined,
    '/opt/homebrew/opt/dotnet@8/libexec/dotnet',
    '/usr/local/opt/dotnet@8/libexec/dotnet',
    join(rootDir, 'release', 'tools', 'dotnet', dotnetExecutableName),
    await findCommand('dotnet'),
  ].filter(Boolean)

  const availableCandidates = await Promise.all(
    candidates.map(async (candidate) => ((await fileExists(candidate)) ? candidate : undefined)),
  )
  return availableCandidates.find((candidate) => candidate !== undefined)
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
    fail(
      'Windows packaging needs Assets/portwatch.ico or ffmpeg available to generate it from Assets/portwatch-icon.png.',
    )
  }

  await run(ffmpeg, [
    '-y',
    '-i',
    join(rootDir, 'Assets', 'portwatch-icon.png'),
    '-vf',
    'scale=256:256',
    '-frames:v',
    '1',
    iconPath,
  ])
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function defaultPlatform() {
  return currentHostPlatform === 'win32' ? 'win32' : 'darwin'
}

function defaultArch(platform) {
  if (platform === 'win32') return 'x64'
  return currentHostArch === 'arm64' ? 'arm64' : 'x64'
}

function normalizePackageVersion(value) {
  return String(value).replace(/^[^\d]*/, '')
}

async function findCommand(command) {
  const lookup = currentHostPlatform === 'win32' ? 'where' : '/bin/sh'
  const args =
    currentHostPlatform === 'win32' ? [command] : ['-lc', `command -v ${shellEscape(command)}`]
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
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: currentHostPlatform === 'win32' && /\.(cmd|bat)$/i.test(command),
    })
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
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
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
