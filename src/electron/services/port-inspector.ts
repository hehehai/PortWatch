import { platform } from 'node:os'
import type { PortRecord } from '../types'
import { runCommand } from './shell'
import { parseWindowsListeningPortsJson } from './windows-port-parser'

interface ProcessMetadata {
  command?: string
  cwd?: string
  executablePath?: string
  startedAt?: string
  uptime?: number
  parentPid?: number
  launchedBy?: string
  launchChain?: string[]
}

interface ProcessTableItem {
  pid: number
  ppid?: number
  command: string
}

export async function fetchListeningPorts(): Promise<PortRecord[]> {
  if (platform() === 'win32') {
    return fetchWindowsListeningPorts()
  }
  return fetchMacListeningPorts()
}

async function fetchMacListeningPorts(): Promise<PortRecord[]> {
  const lsof = await runCommand('/usr/sbin/lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'])
  if (lsof.exitCode !== 0 && lsof.stdout.trim().length === 0) {
    return []
  }

  const baseRecords = parseMacLsof(lsof.stdout)
  const pids = [...new Set(baseRecords.map((record) => record.pid))]
  const [metadata, launchMetadata] = await Promise.all([
    fetchMacProcessMetadata(pids),
    fetchMacLaunchMetadata(pids)
  ])

  return sortAndDedupe(baseRecords.map((record) => {
    const item = metadata.get(record.pid)
    const launch = launchMetadata.get(record.pid)
    const source = resolveSource(record, item)

    return {
      ...record,
      command: item?.command ?? record.command,
      workingDirectory: item?.cwd,
      executablePath: item?.executablePath,
      source,
      startedAt: item?.startedAt,
      uptime: item?.uptime,
      launchedBy: launch?.launchedBy,
      launchChain: launch?.launchChain ?? []
    }
  }))
}

function parseMacLsof(output: string): PortRecord[] {
  const [, ...lines] = output.split(/\r?\n/)
  return lines.flatMap((line) => {
    const parts = line.trim().split(/\s+/, 9)
    if (parts.length < 9) return []

    const [command, rawPid, user, , , , , , endpoint] = parts
    const pid = Number(rawPid)
    const port = parsePort(endpoint)
    if (!Number.isFinite(pid) || !port) return []

    return [{
      id: `${pid}:${port}:${endpoint}`,
      pid,
      command,
      user,
      endpoint,
      address: parseAddress(endpoint),
      port,
      protocolName: 'TCP',
      state: 'LISTEN',
      launchChain: []
    }]
  })
}

async function fetchMacProcessMetadata(pids: number[]): Promise<Map<number, ProcessMetadata>> {
  const metadata = new Map<number, ProcessMetadata>()
  if (pids.length === 0) return metadata

  const pidList = pids.join(',')
  const [lsof, ps] = await Promise.all([
    runCommand('/usr/sbin/lsof', ['-a', '-d', 'cwd,txt', '-Ffnp', '-p', pidList]),
    runCommand('/bin/ps', ['-ww', '-p', pidList, '-o', 'pid=', '-o', 'lstart=', '-o', 'command='])
  ])

  if (lsof.exitCode === 0) {
    let currentPid: number | undefined
    let currentFd: string | undefined
    for (const line of lsof.stdout.split(/\r?\n/)) {
      const field = line[0]
      const value = line.slice(1)
      if (field === 'p') {
        currentPid = Number(value)
        if (!metadata.has(currentPid)) metadata.set(currentPid, {})
        currentFd = undefined
      } else if (field === 'f') {
        currentFd = value
      } else if (field === 'n' && currentPid) {
        const item = metadata.get(currentPid) ?? {}
        if (currentFd === 'cwd') item.cwd = value
        if (currentFd === 'txt' && !item.executablePath) item.executablePath = value
        metadata.set(currentPid, item)
      }
    }
  }

  if (ps.exitCode === 0) {
    const now = Date.now()
    for (const line of ps.stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/)
      if (!match) continue
      const pid = Number(match[1])
      const started = new Date(match[2])
      const item = metadata.get(pid) ?? {}
      item.startedAt = Number.isNaN(started.getTime()) ? undefined : started.toISOString()
      item.uptime = item.startedAt ? Math.max(0, (now - started.getTime()) / 1000) : undefined
      item.command = basename(match[3].split(/\s+/)[0])
      metadata.set(pid, item)
    }
  }

  return metadata
}

async function fetchMacLaunchMetadata(pids: number[]): Promise<Map<number, ProcessMetadata>> {
  const result = new Map<number, ProcessMetadata>()
  if (pids.length === 0) return result

  const ps = await runCommand('/bin/ps', ['-axo', 'pid=', '-o', 'ppid=', '-o', 'command='])
  if (ps.exitCode !== 0) return result

  const table = parseProcessTable(ps.stdout)
  for (const pid of pids) {
    const chain: string[] = []
    let current = table.get(pid)
    const seen = new Set<number>()
    while (current?.ppid && !seen.has(current.ppid) && chain.length < 6) {
      seen.add(current.pid)
      const parent = table.get(current.ppid)
      if (!parent) break
      const name = basename(parent.command.split(/\s+/)[0])
      if (name && name !== 'launchd') chain.unshift(name)
      current = parent
    }
    if (chain.length > 0) {
      result.set(pid, { launchedBy: chain[chain.length - 1], launchChain: chain })
    }
  }

  return result
}

function parseProcessTable(output: string): Map<number, ProcessTableItem> {
  const table = new Map<number, ProcessTableItem>()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
    if (!match) continue
    const pid = Number(match[1])
    table.set(pid, { pid, ppid: Number(match[2]), command: match[3] })
  }
  return table
}

async function fetchWindowsListeningPorts(): Promise<PortRecord[]> {
  const script = `
$connections = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess,State)
$pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
$processes = @(Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | Select-Object ProcessId,Name,CommandLine,ExecutablePath,ParentProcessId,CreationDate)
[PSCustomObject]@{ Connections = $connections; Processes = $processes } | ConvertTo-Json -Depth 4
`
  const result = await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], 15000)
  if (result.exitCode !== 0 || result.stdout.trim().length === 0) return []

  return parseWindowsListeningPortsJson(result.stdout)
}

function parsePort(endpoint: string): number {
  const match = endpoint.match(/:(\d+)(?:\s+\(LISTEN\))?$/)
  return match ? Number(match[1]) : 0
}

function parseAddress(endpoint: string): string {
  return endpoint.replace(/:(\d+)(?:\s+\(LISTEN\))?$/, '')
}

function resolveSource(record: PortRecord, metadata?: ProcessMetadata): string | undefined {
  if (!metadata) return undefined
  if (metadata.cwd && metadata.cwd !== '/') return metadata.cwd
  if (metadata.executablePath) return appName(metadata.executablePath) ?? basename(metadata.executablePath)
  return metadata.command ?? record.command
}

function appName(value: string): string | undefined {
  const match = value.match(/\/([^/]+\.app)\//)
  return match?.[1]?.replace(/\.app$/, '')
}

function basename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() ?? value
}

function sortAndDedupe(records: PortRecord[]): PortRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]))
  return [...byId.values()].sort((a, b) => a.port - b.port || a.pid - b.pid)
}
