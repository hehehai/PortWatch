import type { PortRecord, StarredPort } from '../types'

export function formatPortUptime(seconds?: number): string {
  if (seconds === undefined) return ''
  const value = Math.max(0, Math.floor(seconds))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${value}s`
}

export function portSource(record: PortRecord): string {
  return record.source ?? record.workingDirectory ?? record.executablePath ?? 'Unavailable'
}

export function portPath(record: PortRecord): string | undefined {
  return record.workingDirectory ?? record.executablePath ?? record.source
}

export function buildStarredPort(record: PortRecord): StarredPort | undefined {
  const path = portPath(record)
  if (!path) {
    return undefined
  }

  return {
    port: record.port,
    path,
  }
}

export function canStarPort(record: PortRecord): boolean {
  return buildStarredPort(record) !== undefined
}

export function isStarredPort(record: PortRecord, starredPorts: StarredPort[]): boolean {
  const starredPort = buildStarredPort(record)
  if (!starredPort) {
    return false
  }

  return starredPorts.some(
    (item) => item.port === starredPort.port && item.path === starredPort.path,
  )
}
