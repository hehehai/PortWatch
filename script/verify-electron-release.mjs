#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
const appVersion = packageJson.version
const platform = readOption('--platform') ?? 'all'

if (!['all', 'darwin', 'win32'].includes(platform)) {
  fail('usage: node script/verify-electron-release.mjs [--platform=all|darwin|win32]')
}

const darwinRequiredFiles = [
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/MacOS/PortWatch',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/package.json',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/out/main/main.js',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/out/preload/index.mjs',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/out/renderer/index.html',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/menu-bar-icon.png',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/portwatch-icon.png',
  'release/velopack/darwin-arm64/RELEASES-osx',
  'release/velopack/darwin-arm64/releases.osx.json',
  `release/velopack/darwin-arm64/com.doit.PortWatch-${appVersion}-osx-full.nupkg`,
  'release/velopack/darwin-arm64/com.doit.PortWatch-osx-Portable.zip',
  'release/velopack/darwin-arm64/com.doit.PortWatch-osx-Setup.pkg',
]

const win32RequiredFiles = [
  'release/velopack/win32-x64/RELEASES',
  'release/velopack/win32-x64/releases.win.json',
  'release/app/PortWatch-win32-x64/PortWatch.exe',
  'release/app/PortWatch-win32-x64/resources/app/package.json',
  'release/app/PortWatch-win32-x64/resources/app/out/main/main.js',
  'release/app/PortWatch-win32-x64/resources/app/out/preload/index.mjs',
  'release/app/PortWatch-win32-x64/resources/app/out/renderer/index.html',
  'release/app/PortWatch-win32-x64/resources/menu-bar-icon.png',
  'release/app/PortWatch-win32-x64/resources/portwatch-icon.png',
  `release/velopack/win32-x64/com.doit.PortWatch-${appVersion}-full.nupkg`,
  'release/velopack/win32-x64/com.doit.PortWatch-win-Portable.zip',
  'release/velopack/win32-x64/com.doit.PortWatch-win-Setup.exe',
]

const darwinForbiddenPackagedPaths = [
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/Package.swift',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/Sources',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/PortWatch.xcodeproj',
  'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/app/.git',
]

const win32ForbiddenPackagedPaths = [
  'release/app/PortWatch-win32-x64/resources/app/Package.swift',
  'release/app/PortWatch-win32-x64/resources/app/Sources',
  'release/app/PortWatch-win32-x64/resources/app/PortWatch.xcodeproj',
  'release/app/PortWatch-win32-x64/resources/app/.git',
]

const requiredFiles = [
  ...(platform === 'all' || platform === 'darwin' ? darwinRequiredFiles : []),
  ...(platform === 'all' || platform === 'win32' ? win32RequiredFiles : []),
]

const forbiddenPackagedPaths = [
  ...(platform === 'all' || platform === 'darwin' ? darwinForbiddenPackagedPaths : []),
  ...(platform === 'all' || platform === 'win32' ? win32ForbiddenPackagedPaths : []),
]

await Promise.all(requiredFiles.map((file) => assertExists(file)))
await Promise.all(forbiddenPackagedPaths.map((file) => assertMissing(file)))

if (platform === 'all' || platform === 'darwin') {
  await assertNoExampleUpdateFeed(
    'release/app/PortWatch-darwin-arm64/PortWatch.app/Contents/Resources/portwatch-update.json',
  )
}

if (platform === 'all' || platform === 'win32') {
  await assertNoExampleUpdateFeed('release/app/PortWatch-win32-x64/resources/portwatch-update.json')
}

console.log(`Electron ${platform} release artifacts verified: ${requiredFiles.length} files`)

async function assertExists(relativePath) {
  try {
    await access(join(rootDir, relativePath))
  } catch {
    fail(`Missing required release artifact: ${relativePath}`)
  }
}

async function assertMissing(relativePath) {
  try {
    await access(join(rootDir, relativePath))
    fail(`Forbidden legacy artifact was packaged: ${relativePath}`)
  } catch {
    // Expected.
  }
}

async function assertNoExampleUpdateFeed(relativePath) {
  try {
    const content = await readFile(join(rootDir, relativePath), 'utf8')
    if (content.includes('updates.example.com')) {
      fail(`Example update feed leaked into packaged app: ${relativePath}`)
    }
  } catch {
    // No bundled update config is valid.
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
