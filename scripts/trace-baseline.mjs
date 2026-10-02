// Local synthetic gameplay-kernel measurement. No browser, network or publishing actions.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { BASELINE_SCENARIOS, runScenario } from './lib/baseline-harness.ts'
import { readEffectiveProfile, sha256 } from './lib/baseline-profile.ts'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const args = process.argv.slice(2)
let rates = [30, 60, 120]
let output = `release/e01/run-${new Date().toISOString().replace(/[:.]/g, '-')}`
for (let i = 0; i < args.length; i += 2) {
  if (!args[i + 1]) throw new Error('Each option requires a value')
  if (args[i] === '--hz') {
    const hz = Number(args[i + 1])
    if (![30, 60, 120].includes(hz)) throw new Error('--hz must be 30, 60 or 120')
    rates = [hz]
  } else if (args[i] === '--out') output = args[i + 1]
  else throw new Error(`Unknown option: ${args[i]}`)
}
const allowed = join(root, 'release', 'e01')
const out = resolve(root, output)
const rel = relative(allowed, out)
if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
  throw new Error('--out must be a new child directory of release/e01')
}
for (let path = out; path !== root; path = dirname(path)) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Symbolic links/junctions are not allowed in the output path')
}
if (existsSync(out)) throw new Error('Output directory already exists; preserve previous evidence')

const git = (...argv) => execFileSync('git', argv, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
const effective = readEffectiveProfile(root)
const manifest = {
  schema: 'e01-local-kernel-evidence/v1', sourceHead: git('rev-parse', 'HEAD'),
  workingTreeStatus: git('status', '--porcelain'),
  reviewedPlan: '389a9a657edbdc94da18c7bdb75d62081787b54d',
  environment: { node: process.version, platform: platform(), os: release(), cpu: cpus()[0]?.model ?? null },
  runnerHashes: Object.fromEntries(['scripts/trace-baseline.mjs', 'scripts/lib/baseline-harness.ts', 'scripts/lib/baseline-profile.ts',
    'scripts/lib/baseline-visibility.ts', 'scripts/baseline-view.ts', 'scripts/baseline-view.html']
    .map(path => [path, sha256(readFileSync(join(root, path)))])),
  assetHashes: Object.fromEntries(['public/models/zhaoyun.glb', 'public/models/zhaoyun.manifest.json']
    .map(path => [path, sha256(readFileSync(join(root, path)))])),
  effectiveProfileHash: sha256(JSON.stringify(effective)),
  captureKind: 'synthetic production-kernel fixture; constructor/presentation bypassed',
  visiblePopulation: 'NOT_MEASURED', renderer: 'NOT_RUN', gpuTiming: 'NOT_RUN', inputToPhoton: 'NOT_RUN',
  traces: [], cpuSamples: [], failures: [],
}
mkdirSync(out, { recursive: true })
const write = (name, data) => {
  const text = JSON.stringify(data, null, 2) + '\n'
  writeFileSync(join(out, name), text, { encoding: 'utf8', flag: 'wx' })
  return { file: name, bytes: Buffer.byteLength(text), sha256: sha256(text) }
}
write('effective-profile.json', effective)

function check(trace) {
  const started = trace.frames.flatMap(frame => frame.events.filter(event => event.type === 'moveStart').map(event => event.moveId))
  const id = trace.scenario.id
  const failures = []
  if (id === 'early_combo' && !started.includes('N2')) failures.push('early buffer did not reach N2')
  if (id === 'hitstop_input') {
    const charge = trace.frames.find(frame => frame.input.charge)
    if (!charge || charge.before.hitstop <= 0 || charge.after.simClock !== charge.before.simClock || !started.includes('C2')) {
      failures.push('hitstop input retention was not observed')
    }
  }
  if (id === 'pause_buffer' || id === 'blur_buffer') {
    if (!trace.frames.some(frame => frame.after.mode === 'paused') || started.includes('C2') || trace.final.mode !== 'playing') {
      failures.push('pause/blur buffer clearing was not observed')
    }
  }
  if (id.startsWith('hit_')) {
    const hits = trace.frames.flatMap(frame => frame.hits)
    if (hits.reduce((total, hit) => total + hit.targets.length, 0) !== trace.scenario.population) failures.push('first C4 window target count mismatch')
  }
  if (trace.final.population.visible !== null) failures.push('visible unknown was replaced by an asserted value')
  return failures
}

try {
  for (const hz of rates) {
    for (const scenario of Object.values(BASELINE_SCENARIOS)) {
      const trace = runScenario(scenario, hz)
      const plain = runScenario(scenario, hz, { observe: false })
      const failures = check(trace)
      if (!isDeepStrictEqual(trace.final, plain.final) || !isDeepStrictEqual(trace.finalEnemyState, plain.finalEnemyState)) {
        failures.push('instrumentation changed the production-kernel outcome')
      }
      const artifact = write(`${scenario.id}-${hz}hz.json`, trace)
      manifest.traces.push({ ...artifact, scenario: scenario.id, hz, result: failures.length ? 'FAIL' : 'PASS', failures })
      manifest.failures.push(...failures.map(reason => ({ scenario: scenario.id, hz, reason })))
      // Fixed iteration counts preserve stamp ordering. CPU timing is separate from deterministic traces.
      for (let sample = 0; sample < 5; sample++) {
        const order = sample % 2 ? [true, false] : [false, true]
        const values = { scenario: scenario.id, hz, sample, order }
        for (const observe of order) {
          const start = performance.now()
          runScenario(scenario, hz, { observe })
          values[observe ? 'recordedMs' : 'plainMs'] = performance.now() - start
        }
        manifest.cpuSamples.push(values)
      }
    }
  }
} catch (error) {
  manifest.failures.push({ reason: String(error), classification: 'TEST_FAILURE_OR_TOOL_FAILURE_UNRESOLVED' })
}
manifest.result = manifest.failures.length ? 'FAIL' : 'PASS_SCOPED_KERNEL_ONLY'
manifest.fullE01Verdict = 'INCOMPLETE: real visible population, Web/runtime evidence and formal delivery remain required'
write('manifest.json', manifest)
console.log(`${manifest.result}: ${manifest.traces.length} traces → ${relative(root, out)}`)
if (manifest.failures.length) process.exitCode = 1
