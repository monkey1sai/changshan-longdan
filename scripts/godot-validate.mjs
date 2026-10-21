#!/usr/bin/env node
import { validateGodot } from './lib/godot-execution.mjs'

const keys = new Map([['--mode', 'mode'], ['--godot', 'executable'], ['--project', 'project'],
  ['--templates', 'templates'], ['--lock', 'lockPath'], ['--out', 'output'], ['--timeout-ms', 'timeoutMs']])
try {
  const options = {}
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 2) {
    const key = keys.get(args[i])
    if (!key || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('INVALID_ARGUMENTS')
    options[key] = args[i + 1]
  }
  if (['mode', 'executable', 'project', 'templates', 'lockPath', 'output'].some(key => !options[key]) ||
    !['inventory', 'tests', 'export'].includes(options.mode)) throw new Error('INVALID_ARGUMENTS')
  if (options.timeoutMs !== undefined) {
    options.timeoutMs = Number(options.timeoutMs)
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 600000) throw new Error('INVALID_TIMEOUT')
  }
  const result = await validateGodot(options)
  console.log(JSON.stringify({ status: result.status, runId: result.runId, candidate: result.candidate, mode: result.mode, error: result.error ?? null, output: options.output }))
  process.exitCode = result.status === 'PASS' ? 0 : 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
