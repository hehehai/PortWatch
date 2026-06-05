import { execFile } from 'node:child_process'

export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
}

export function runCommand(command: string, args: string[], timeout = 8000): Promise<ShellResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: typeof error?.code === 'number' ? error.code : 0,
        })
      },
    )
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
