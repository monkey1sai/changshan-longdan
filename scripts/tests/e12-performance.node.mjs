import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { EventEmitter } from 'node:events'
import { scopedE12Path, snapshotPayload, watchExit } from '../lib/e12-process.mjs'
import { nearestRank, timeMs, metricSummary, gpuInstances, probeVerdict, parseProbeCsv, validateGpuSeries, validateProbeIdentity } from '../lib/e12-performance.mjs'

test('nearest-rank boundary uses ceil and never interpolation', () => {
  assert.equal(nearestRank([5, 1, 4, 3, 2], 0.95), 5)
  assert.equal(nearestRank([5, 1, 4, 3, 2], 0.2), 1)
  assert.throws(() => nearestRank([], 0.95)); assert.throws(() => nearestRank([NaN], 0.95))
})
test('recorder units and missing/zero samples fail closed', () => {
  assert.equal(timeMs(16670000, 'TimeNanoseconds'), 16.67)
  for (const raw of [null, undefined, 0, NaN, Infinity, -1]) assert.equal(timeMs(raw, 'TimeNanoseconds'), null)
  assert.equal(timeMs(16.67, 'Unknown'), null)
})
const frame = (overrides = {}) => ({ wallMs: 16.67, mainMs: 10, renderMs: 12, gpuMs: 8, ...overrides })
test('timing gates do not sum CPU and GPU', () => {
  assert.equal(metricSummary([frame()]).status, 'PASS_METRICS_ONLY')
  assert.equal(metricSummary([frame({ mainMs: 16.68 })]).status, 'FAIL_METRICS')
  assert.equal(metricSummary([frame({ gpuMs: null })]).status, 'BLOCKED')
})
test('CPU gate is max of separate quantiles rather than quantile of per-frame max', () => {
  const frames = Array.from({ length: 100 }, (_, i) => frame({ mainMs: i < 4 ? 20 : 10, renderMs: i >= 4 && i < 8 ? 20 : 10 }))
  assert.equal(metricSummary(frames).metrics.cpuActiveGateMs, 10)
})
test('strict raw >50ms threshold and exact 0.1 percent boundary', () => {
  const frames = Array.from({ length: 1000 }, () => frame())
  frames[0].wallMs = 50; assert.equal(metricSummary(frames).metrics.over50Fraction, 0)
  frames[0].wallMs = 50.00000001; assert.equal(metricSummary(frames).status, 'PASS_METRICS_ONLY')
  frames[1].wallMs = 51; assert.equal(metricSummary(frames).status, 'FAIL_METRICS')
})
const expected = { pid: 42, processStart: '2026-10-07T10:00:00Z' }
const gpu = { ...expected, utc: '2026-10-07T10:00:03Z', queryEndUtc: '2026-10-07T10:00:03.100Z', instances: [
  { name: 'pid_42_luid_A_phys_0', dedicatedBytes: 100, sharedBytes: 20, committedBytes: 150, counterType: 65792, timestampUtc: '2026-10-07T10:00:03Z' }] }
test('VRAM requires exact process identity, fresh sample and raw instances', () => {
  assert.deepEqual(gpuInstances(gpu, expected), { dedicatedBytes: 100, sharedBytes: 20, committedBytes: 150 })
  for (const bad of [{ ...gpu, pid: 41 }, { ...gpu, processStart: 'other' }, { ...gpu, queryEndUtc: '2026-10-07T10:00:08Z' }, { ...gpu, instances: [] },
    { ...gpu, instances: [{ ...gpu.instances[0], name: 'pid_41_luid_A_phys_0' }] }]) assert.equal(gpuInstances(bad, expected), null)
  for (const timestampUtc of [null, 'invalid', '2026-10-07T10:00:00Z'])
    assert.equal(gpuInstances({ ...gpu, instances: [{ ...gpu.instances[0], timestampUtc }] }, expected), null)
})
test('invalid or retreating GPU timestamps cannot reset an accepted high-water mark', () => {
  const sample = (query, at) => ({ ...gpu, utc: `2026-10-07T10:00:0${query}Z`, queryEndUtc: `2026-10-07T10:00:0${query}.100Z`,
    instances: [{ ...gpu.instances[0], timestampUtc: at === null ? null : `2026-10-07T10:00:0${at}Z` }] })
  for (const middle of [null, 2, 3])
    assert.deepEqual(validateGpuSeries([sample(3, 3), sample(4, middle), sample(5, 3)], expected).map(s => s.usage !== null), [true, false, false])
  assert.deepEqual(validateGpuSeries([sample(3, 3), sample(4, null), sample(5, 5)], expected).map(s => s.usage !== null), [true, false, true])
})
test('Player probe binds the same launch UUID and PID', () => {
  const command = { pid: 42, runId: 'same-run' }, report = { ...command, kind: 'CAPABILITY_PROBE' }
  assert.doesNotThrow(() => validateProbeIdentity(report, command))
  assert.throws(() => validateProbeIdentity({ ...report, pid: 41 }, command))
  assert.throws(() => validateProbeIdentity({ ...report, runId: 'other-run' }, command))
})
test('short probe never promotes diagnostic metrics to formal benchmark PASS', () => {
  const report = { kind: 'CAPABILITY_PROBE', frames: 1, pid: 42, width: 1920, height: 1080, renderScale: 1, refresh: 60,
    vSync: 1, cap: 60, batchMode: false, visibleProvider: 'UNAVAILABLE', gaps: [] }
  const verdict = probeVerdict(report, [frame({ frame: 1, seconds: 3, focus: false, foregroundPid: 41, visible: null })])
  assert.equal(verdict.benchmarkAllowed, false)
  assert.ok(verdict.gaps.includes('VISIBLE_PROVIDER_UNAVAILABLE')); assert.ok(verdict.gaps.includes('FOREGROUND_NOT_PROVEN'))
  assert.equal(verdict.formalBenchmark, 'NOT_RUN')
})
test('CSV truncation and malformed values cannot masquerade as samples', () => {
  assert.throws(() => parseProbeCsv('frame,focus,minimized\n1,True', {}), /TRUNCATED/)
  assert.throws(() => parseProbeCsv('frame,focus,minimized\nNaN,True,False', {}), /NUMBER/)
  assert.throws(() => parseProbeCsv('frame,focus,minimized\n1,maybe,False', {}), /BOOLEAN/)
})
test('refusing existing complete and incomplete evidence preserves their contents', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const parent = path.join(root, 'release/e12'); fs.mkdirSync(parent, { recursive: true })
  for (const complete of [false, true]) {
  const directory = fs.mkdtempSync(path.join(parent, 'existing-evidence-test-'))
  const sentinel = path.join(directory, 'sentinel.txt'); fs.writeFileSync(sentinel, 'preserve')
  if (complete) fs.writeFileSync(path.join(directory, 'result.json'), 'existing result')
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/e12-probe.mjs'), '--build', 'release/e02/not-used', '--out', path.relative(root, directory).replaceAll('\\', '/')], { encoding: 'utf8' })
    assert.equal(result.status, 2)
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve')
    assert.deepEqual(fs.readdirSync(directory), complete ? ['result.json', 'sentinel.txt'] : ['sentinel.txt'])
    if (complete) assert.equal(fs.readFileSync(path.join(directory, 'result.json'), 'utf8'), 'existing result')
  } finally {
    // Delete only files owned by this test in its generated, resolved directory.
    fs.unlinkSync(sentinel)
    if (fs.existsSync(path.join(directory, 'result.json'))) fs.unlinkSync(path.join(directory, 'result.json'))
    fs.rmdirSync(directory)
  }
  }
})
test('recorder metadata with no valid samples keeps numeric CSV timing unknown', () => {
  const text = 'frame,focus,minimized,cpuMainRaw,cpuRenderRaw,gpuRaw\n1,True,False,1000000,2000000,3000000'
  const report = { frames: 1, counters: ['CPU Main Thread Frame Time', 'CPU Render Thread Frame Time', 'GPU Frame Time'].map(name =>
    ({ name, unit: 'TimeNanoseconds', available: true, validAtEnd: true, sampleCount: 1, reads: 1 })) }
  assert.equal(parseProbeCsv(text, report)[0].gpuMs, 3)
  report.counters[2].validAtEnd = false
  assert.equal(parseProbeCsv(text, report)[0].gpuMs, null)
})
test('resolved E12 output and build paths reject traversal and prefix roots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e12-scope-test-'))
  try {
    for (const prefix of ['release/e12', 'release/e02']) {
      assert.equal(scopedE12Path(root, `${prefix}/run`, prefix), path.join(root, prefix, 'run'))
      for (const bad of [prefix, `${prefix}/../../docs`, `${prefix}/../other/run`, `${prefix}/../../../outside`])
        assert.throws(() => scopedE12Path(root, bad, prefix))
    }
  } finally { fs.rmdirSync(root) }
})
test('spawn error is observed and resolves through the controlled cleanup path', async () => {
  const child = new EventEmitter(), exit = watchExit(child)
  child.emit('error', Object.assign(new Error('missing helper'), { code: 'ENOENT' }))
  assert.deepEqual(await exit, { code: null, signal: null, error: 'ENOENT' })
  child.emit('close', -2, null)
})
test('managed payload substitution changes immutable build snapshot', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e12-payload-test-')), filename = path.join(directory, 'Changshan.Combat.dll')
  try {
    fs.writeFileSync(filename, 'original'); const before = snapshotPayload(directory)
    fs.writeFileSync(filename, 'replaced'); assert.notDeepEqual(snapshotPayload(directory), before)
    assert.equal(before['Changshan.Combat.dll'].bytes, 8)
  } finally { fs.unlinkSync(filename); fs.rmdirSync(directory) }
})
