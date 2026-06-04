#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { platform } from 'node:os'

const current = platform()

if (current === 'darwin') {
  const lsof = await run('/usr/sbin/lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'])
  if (lsof.exitCode !== 0 && lsof.stdout.trim().length === 0) {
    fail(`lsof failed: ${lsof.stderr || 'no output'}`)
  }

  const rows = lsof.stdout.trim().split(/\r?\n/).slice(1)
  console.log(`macOS listening TCP rows: ${rows.length}`)
  process.exit(0)
}

if (current === 'win32') {
  const script = `
$connections = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess,State)
$pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
$processes = @(Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | Select-Object ProcessId,Name,ExecutablePath,ParentProcessId,CreationDate)
[PSCustomObject]@{ Connections = $connections; Processes = $processes } | ConvertTo-Json -Depth 4
`
  const ports = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], 15000)
  if (ports.exitCode !== 0 || ports.stdout.trim().length === 0) {
    fail(`PowerShell port query failed: ${ports.stderr || 'no output'}`)
  }

  const taskkill = await run('where.exe', ['taskkill.exe'])
  if (taskkill.exitCode !== 0) {
    fail('taskkill.exe was not found in PATH.')
  }

  const parsed = JSON.parse(ports.stdout)
  const count = Array.isArray(parsed.Connections)
    ? parsed.Connections.length
    : parsed.Connections ? 1 : 0
  console.log(`Windows listening TCP rows: ${count}`)
  process.exit(0)
}

fail(`Unsupported verification platform: ${current}`)

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
