#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { platform } from 'node:os'

const current = platform()
const server = await listenForVerification()
const port = server.address().port

try {
  if (current === 'darwin') {
    const lsof = await run('/usr/sbin/lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-P', '-n'])
    if (lsof.exitCode !== 0 || !lsof.stdout.includes(String(port))) {
      fail(`lsof failed to find temporary listener on port ${port}: ${lsof.stderr || lsof.stdout || 'no output'}`)
    }

    console.log(`macOS listening TCP verification port: ${port}`)
    process.exit(0)
  }

  if (current === 'win32') {
    const script = `
$connections = @(Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object LocalAddress,LocalPort,OwningProcess,State)
$pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
$processes = @(Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | Select-Object ProcessId,Name,ExecutablePath,ParentProcessId,CreationDate)
[PSCustomObject]@{ Connections = $connections; Processes = $processes } | ConvertTo-Json -Depth 4
`
    const ports = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], 15000)
    if (ports.exitCode !== 0 || ports.stdout.trim().length === 0) {
      fail(`PowerShell port query failed for temporary listener on port ${port}: ${ports.stderr || 'no output'}`)
    }

    const taskkill = await run('where.exe', ['taskkill.exe'])
    if (taskkill.exitCode !== 0) {
      fail('taskkill.exe was not found in PATH.')
    }

    const parsed = JSON.parse(ports.stdout)
    const connections = normalizeArray(parsed.Connections)
    if (!connections.some((connection) => Number(connection.LocalPort) === port)) {
      fail(`PowerShell did not report temporary listener on port ${port}.`)
    }

    console.log(`Windows listening TCP verification port: ${port}`)
    process.exit(0)
  }

  fail(`Unsupported verification platform: ${current}`)
} finally {
  server.close()
}

function listenForVerification() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function normalizeArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function run(command, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: typeof error?.code === 'number' ? error.code : 0
      })
    })
  })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
