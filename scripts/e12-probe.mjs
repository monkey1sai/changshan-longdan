import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { requireSafePath, sha256, snapshotSource, validateUnchangedSource, validateCandidateCheckout } from './lib/unity-execution.mjs'
import { parseProbeCsv, probeVerdict, gpuInstances } from './lib/e12-performance.mjs'

const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)))
const args = process.argv.slice(2), options = {}
const write = (filename, data) => fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
const git = argv => {
  const r = spawnSync('git', argv, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 })
  if (r.status !== 0 || r.error) throw new Error('GIT_FAILED')
  return r.stdout
}
let output, child, helper, timer, stdout, stderr
try {
  if (process.platform !== 'win32' || args.length !== 4) throw new Error('Usage: --build release/e02/<validated-run> --out release/e12/<fresh-probe>')
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].slice(2)
    if (!['build', 'out'].includes(name) || options[name] || !args[i + 1]) throw new Error('INVALID_ARGUMENTS')
    options[name] = args[i + 1]
  }
  if (!options.build?.startsWith('release/e02/') || !options.out?.startsWith('release/e12/')) throw new Error('INVALID_SCOPE')
  const build = requireSafePath(root, path.resolve(root, options.build))
  output = requireSafePath(root, path.resolve(root, options.out))
  if (fs.existsSync(output)) throw new Error('OUTPUT_EXISTS')
  const head = validateCandidateCheckout(git(['rev-parse', 'HEAD']).trim(), git(['status', '--porcelain', '--untracked-files=all']))
  const validation = JSON.parse(fs.readFileSync(path.join(build, 'result.json'), 'utf8'))
  if (validation.result !== 'PASS_LOCAL_ENGINE_FOUNDATION' || validation.sourceHead !== head) throw new Error('BUILD_NOT_VALIDATED_FOR_HEAD')
  validateUnchangedSource(validation.sourceAfter, snapshotSource(root))
  const player = requireSafePath(build, path.join(build, 'build/player/ChangshanLongdan.exe'))
  if (sha256(player) !== validation.playerSha256) throw new Error('PLAYER_HASH_MISMATCH')
  fs.mkdirSync(output, { recursive: true })
  const data = path.join(output, 'capture'); fs.mkdirSync(data)
  const argv = ['-e12Probe', data, '-e09NoFlow', '-screen-width', '1920', '-screen-height', '1080', '-logFile', path.join(output, 'Player.log')]
  const record = { runId: randomUUID(), kind: 'CAPABILITY_PROBE', sourceHead: head, validationRunId: validation.runId,
    playerSha256: validation.playerSha256, player, argv, start: new Date().toISOString(), timeoutMs: 90000,
    authorization: 'Local E12 measurement/probe only; no remote write, deployment, paid action or process termination outside own launch handles.' }
  write(path.join(output, 'command.json'), record)
  stdout = fs.openSync(path.join(output, 'stdout.log'), 'wx'); stderr = fs.openSync(path.join(output, 'stderr.log'), 'wx')
  child = spawn(player, argv, { cwd: path.dirname(player), windowsHide: false, stdio: ['ignore', stdout, stderr] })
  record.pid = child.pid
  helper = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', path.join(root, 'scripts/e12-gpu-telemetry.ps1'),
    '-TargetPid', String(child.pid), '-Output', path.join(output, 'gpu.jsonl')], { windowsHide: true, stdio: ['ignore', stdout, stderr] })
  let timedOut = false
  timer = setTimeout(() => { timedOut = true; child.kill() }, record.timeoutMs)
  const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })) })
  clearTimeout(timer)
  await new Promise(resolve => {
    if (helper.exitCode !== null) return resolve()
    const deadline = setTimeout(() => { helper.kill(); resolve() }, 5000)
    helper.once('close', () => { clearTimeout(deadline); resolve() })
  })
  Object.assign(record, exit, { timedOut, end: new Date().toISOString() })
  write(path.join(output, 'exit.json'), record)
  if (exit.code !== 0 || timedOut) throw new Error('PLAYER_PROBE_FAILED')
  const report = JSON.parse(fs.readFileSync(path.join(data, 'probe.json'), 'utf8'))
  if (report.pid !== record.pid) throw new Error('PROBE_PID_MISMATCH')
  const frames = parseProbeCsv(fs.readFileSync(path.join(data, 'frames.csv'), 'utf8'), report)
  const gpuFile = path.join(output, 'gpu.jsonl')
  const rawGpu = fs.existsSync(gpuFile) ? fs.readFileSync(gpuFile, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : []
  const gpu = rawGpu.map(s => ({ ...s, usage: gpuInstances(s, { pid: record.pid, processStart: rawGpu[0]?.processStart, seconds: s.seconds }) }))
  const verdict = probeVerdict(report, frames, gpu.filter(s => s.usage !== null))
  verdict.gpu = { samples: gpu.length, valid: gpu.filter(s => s.usage !== null).length, osBudgetBytes: null, budgetOccupancy: null }
  verdict.sourceHead = head; verdict.runId = record.runId; verdict.reportSha256 = sha256(path.join(data, 'probe.json'))
  verdict.framesSha256 = sha256(path.join(data, 'frames.csv'))
  validateUnchangedSource(validation.sourceAfter, snapshotSource(root))
  write(path.join(output, 'result.json'), verdict)
  process.stdout.write(JSON.stringify(verdict, null, 2) + '\n')
  process.exitCode = 2 // A short probe with missing true visibility is explicitly not an E12 completion.
} catch (error) {
  if (output && fs.existsSync(output) && !fs.existsSync(path.join(output, 'result.json'))) write(path.join(output, 'result.json'), { status: 'TOOL_FAILURE', error: error.message })
  process.stderr.write(error.message + '\n'); process.exitCode = 2
} finally {
  clearTimeout(timer)
  if (child && child.exitCode === null) child.kill()
  if (helper && helper.exitCode === null) helper.kill()
  if (stdout !== undefined) fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr)
}
