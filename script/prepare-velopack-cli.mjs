#!/usr/bin/env node
import { createWriteStream } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import https from 'node:https'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const version = process.env.VELOPACK_CLI_VERSION ?? '1.2.0'
const toolsDir = join(rootDir, 'release', 'tools')
const packagePath = join(toolsDir, `vpk.${version}.nupkg`)
const extractDir = join(toolsDir, `vpk-${version}`)
const packageUrl = `https://api.nuget.org/v3-flatcontainer/vpk/${version}/vpk.${version}.nupkg`

await mkdir(toolsDir, { recursive: true })
await download(packageUrl, packagePath)
await rm(extractDir, { recursive: true, force: true })
await mkdir(extractDir, { recursive: true })
await extract(packagePath, extractDir)
await cp(join(extractDir, 'vendor'), join(extractDir, 'tools', 'net8.0', 'any', 'vendor'), {
  recursive: true,
})

console.log(
  `Prepared Velopack CLI package: ${join(extractDir, 'tools', 'net8.0', 'any', 'vpk.dll')}`,
)
console.log(
  'Install a .NET 8+ runtime or set DOTNET_PATH before running pnpm run package:mac/package:win.',
)

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume()
        download(response.headers.location, destination).then(resolve, reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`))
        response.resume()
        return
      }

      const file = createWriteStream(destination)
      response.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
      file.on('error', reject)
    })

    request.setTimeout(180000, () => {
      request.destroy(new Error(`Timed out downloading ${url}`))
    })
    request.on('error', reject)
  })
}

function extract(archivePath, outputDir) {
  if (process.platform === 'win32') {
    return run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath ${quotePowerShell(archivePath)} -DestinationPath ${quotePowerShell(outputDir)} -Force`,
    ])
  }

  return run('unzip', ['-q', archivePath, '-d', outputDir])
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`
}
