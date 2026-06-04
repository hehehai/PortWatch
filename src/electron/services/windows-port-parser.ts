import type { PortRecord } from '../../shared/types'

export interface WindowsConnection {
  LocalAddress: string
  LocalPort: number
  OwningProcess: number
  State: string
}

export interface WindowsProcess {
  ProcessId: number
  Name?: string
  CommandLine?: string
  ExecutablePath?: string
  ParentProcessId?: number
  CreationDate?: string
}

export function parseWindowsListeningPortsJson(output: string, now = Date.now()): PortRecord[] {
  const parsed = JSON.parse(output) as {
    Connections?: unknown
    Processes?: unknown
  }
  const connections = normalizeArray<WindowsConnection>(parsed.Connections)
  const processItems = normalizeArray<WindowsProcess>(parsed.Processes)
  const processes = new Map(processItems.map((item) => [item.ProcessId, item]))

  return sortAndDedupe(connections.flatMap((connection) => {
    const pid = Number(connection.OwningProcess)
    const port = Number(connection.LocalPort)
    if (!Number.isFinite(pid) || !Number.isFinite(port)) return []

    const process = processes.get(pid)
    const startedAt = parseWindowsDate(process?.CreationDate)
    const command = process?.Name?.replace(/\.exe$/i, '') ?? `PID ${pid}`
    const endpoint = `${connection.LocalAddress}:${port} (LISTEN)`

    return [{
      id: `${pid}:${port}:${connection.LocalAddress}`,
      pid,
      command,
      endpoint,
      address: connection.LocalAddress,
      port,
      protocolName: 'TCP',
      state: connection.State ?? 'Listen',
      executablePath: process?.ExecutablePath,
      source: process?.ExecutablePath ?? command,
      startedAt: startedAt?.toISOString(),
      uptime: startedAt ? Math.max(0, (now - startedAt.getTime()) / 1000) : undefined,
      launchedBy: process?.ParentProcessId ? `PID ${process.ParentProcessId}` : undefined,
      launchChain: process?.ParentProcessId ? [`PID ${process.ParentProcessId}`] : []
    }]
  }))
}

function normalizeArray<T>(value: unknown): T[] {
  if (!value) return []
  return Array.isArray(value) ? value as T[] : [value as T]
}

function parseWindowsDate(value?: string): Date | undefined {
  if (!value) return undefined
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?([+-]\d{3})?/)
  if (!match) return undefined
  const offsetMinutes = match[7] ? Number(match[7]) : 0
  const timestamp = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  ) - offsetMinutes * 60_000
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function sortAndDedupe(records: PortRecord[]): PortRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]))
  return [...byId.values()].sort((a, b) => a.port - b.port || a.pid - b.pid)
}
