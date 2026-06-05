import { platform } from 'node:os'
import { runCommand, sleep } from './shell'
import { windowsTaskkillArgs } from './process-commands'

export async function terminateProcess(pid: number): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID: ${pid}`)
  }

  if (platform() === 'win32') {
    const result = await runCommand('taskkill.exe', windowsTaskkillArgs(pid))
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `Failed to terminate PID ${pid}`)
    }
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch (error) {
    throw new Error(`Failed to send SIGTERM to PID ${pid}: ${String(error)}`, {
      cause: error,
    })
  }

  await sleep(600)
  if (processExists(pid)) {
    process.kill(pid, 'SIGKILL')
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
