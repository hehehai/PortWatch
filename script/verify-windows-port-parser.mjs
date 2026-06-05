#!/usr/bin/env node
import assert from 'node:assert/strict'
import { parseWindowsListeningPortsJson } from '../src/electron/services/windows-port-parser.ts'
import { windowsTaskkillArgs } from '../src/electron/services/process-commands.ts'

const now = Date.parse('2026-06-04T08:00:00Z')

const singleObjectOutput = JSON.stringify({
  Connections: {
    LocalAddress: '127.0.0.1',
    LocalPort: 3000,
    OwningProcess: 4242,
    State: 'Listen',
  },
  Processes: {
    ProcessId: 4242,
    Name: 'node.exe',
    ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe',
    ParentProcessId: 1200,
    CreationDate: '20260604070000.000000+000',
  },
})

const arrayOutput = JSON.stringify({
  Connections: [
    {
      LocalAddress: '0.0.0.0',
      LocalPort: 9222,
      OwningProcess: 7,
      State: 'Listen',
    },
    {
      LocalAddress: '::',
      LocalPort: 80,
      OwningProcess: 8,
      State: 'Listen',
    },
  ],
  Processes: [
    {
      ProcessId: 7,
      Name: 'chrome.exe',
      ExecutablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ParentProcessId: 1,
      CreationDate: '20260604060000.000000+000',
    },
    {
      ProcessId: 8,
      Name: 'nginx.exe',
      ExecutablePath: 'C:\\nginx\\nginx.exe',
      ParentProcessId: 1,
      CreationDate: '20260604050000.000000+000',
    },
  ],
})

const single = parseWindowsListeningPortsJson(singleObjectOutput, now)
assert.equal(single.length, 1)
assert.equal(single[0].port, 3000)
assert.equal(single[0].pid, 4242)
assert.equal(single[0].command, 'node')
assert.equal(single[0].source, 'C:\\Program Files\\nodejs\\node.exe')
assert.equal(single[0].launchedBy, 'PID 1200')
assert.equal(single[0].uptime, 3600)

const records = parseWindowsListeningPortsJson(arrayOutput, now)
assert.deepEqual(
  records.map((record) => record.port),
  [80, 9222],
)
assert.equal(records[0].command, 'nginx')
assert.equal(records[1].command, 'chrome')
assert.equal(records[1].endpoint, '0.0.0.0:9222 (LISTEN)')

assert.deepEqual(windowsTaskkillArgs(4242), ['/PID', '4242', '/T', '/F'])
assert.throws(() => windowsTaskkillArgs(0), /Invalid PID/)

console.log(
  `Windows parser and taskkill fixtures passed: ${single.length + records.length} records`,
)
