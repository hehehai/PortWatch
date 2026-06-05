#!/usr/bin/env node
import { access, rename, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const requireFromRoot = createRequire(join(rootDir, 'package.json'))
const platform = readOption('--platform')
const arch = readOption('--arch')

if (!platform || !arch) {
  fail('usage: node script/sign-release-assets.mjs --platform=darwin|win32 --arch=arm64|x64')
}

if (platform === 'darwin') {
  await signDarwinInstaller(arch)
} else if (platform === 'win32') {
  await signWindowsInstaller(arch)
} else {
  fail(`Unsupported platform "${platform}".`)
}

async function signDarwinInstaller(targetArch) {
  const installerIdentity = process.env.PORTWATCH_APPLE_INSTALLER_IDENTITY
  if (!installerIdentity) {
    console.log(
      'Skipping macOS installer signing because PORTWATCH_APPLE_INSTALLER_IDENTITY is not set.',
    )
    return
  }

  const pkgPath = join(
    rootDir,
    'release',
    'velopack',
    `darwin-${targetArch}`,
    'com.doit.PortWatch-osx-Setup.pkg',
  )
  await assertExists(pkgPath)

  const signedPkgPath = join(tmpdir(), `PortWatch-${Date.now()}-signed.pkg`)
  await run('productsign', ['--sign', installerIdentity, pkgPath, signedPkgPath])
  await rename(signedPkgPath, pkgPath)

  const notaryArgs = buildMacNotaryArgs()
  if (notaryArgs) {
    await run('xcrun', ['notarytool', 'submit', pkgPath, '--wait', ...notaryArgs])
    await run('xcrun', ['stapler', 'staple', pkgPath])
  }

  console.log(`Signed macOS installer: ${pkgPath}`)
}

async function signWindowsInstaller(targetArch) {
  if (!process.env.WINDOWS_CERTIFICATE_FILE && !process.env.WINDOWS_SIGN_WITH_PARAMS) {
    console.log('Skipping Windows installer signing because Windows signing env vars are not set.')
    return
  }

  const setupExePath = join(
    rootDir,
    'release',
    'velopack',
    `win32-${targetArch}`,
    'com.doit.PortWatch-win-Setup.exe',
  )
  await assertExists(setupExePath)

  const packagerEntry = requireFromRoot.resolve('@electron/packager')
  const requireFromPackager = createRequire(packagerEntry)
  const windowsSignModulePath = requireFromPackager.resolve('@electron/windows-sign')
  const { sign } = await import(pathToFileURL(windowsSignModulePath).href)

  await sign({
    files: [setupExePath],
    certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
    certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER,
    description: process.env.WINDOWS_SIGN_DESCRIPTION ?? 'PortWatch',
    website: process.env.WINDOWS_SIGN_WEBSITE,
    signToolPath: process.env.WINDOWS_SIGNTOOL_PATH,
    signWithParams: process.env.WINDOWS_SIGN_WITH_PARAMS,
  })

  console.log(`Signed Windows installer: ${setupExePath}`)
}

function buildMacNotaryArgs() {
  const apiKeyPath = process.env.PORTWATCH_APPLE_NOTARY_API_KEY_PATH
  const apiKeyId = process.env.PORTWATCH_APPLE_NOTARY_API_KEY_ID
  const apiIssuer = process.env.PORTWATCH_APPLE_NOTARY_API_ISSUER
  if (apiKeyPath && apiKeyId) {
    const args = ['--key', apiKeyPath, '--key-id', apiKeyId]
    if (apiIssuer) {
      args.push('--issuer', apiIssuer)
    }
    return args
  }

  const appleId = process.env.PORTWATCH_APPLE_ID
  const appleIdPassword = process.env.PORTWATCH_APPLE_ID_PASSWORD
  const teamId = process.env.PORTWATCH_APPLE_TEAM_ID
  if (appleId && appleIdPassword && teamId) {
    return ['--apple-id', appleId, '--password', appleIdPassword, '--team-id', teamId]
  }

  return undefined
}

async function assertExists(path) {
  try {
    await access(path, constants.R_OK)
  } catch {
    fail(`Missing release asset to sign: ${path}`)
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  console.error(message)
  void rm(join(tmpdir(), 'PortWatch-signed.pkg'), { force: true }).catch(() => undefined)
  process.exit(1)
}
