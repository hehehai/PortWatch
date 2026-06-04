export function windowsTaskkillArgs(pid: number): string[] {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID: ${pid}`)
  }

  return ['/PID', String(pid), '/T', '/F']
}
