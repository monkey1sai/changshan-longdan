import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestRank, timeMs, metricSummary, gpuInstances, probeVerdict, parseProbeCsv } from '../lib/e12-performance.mjs'

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
const expected = { pid: 42, processStart: '2026-10-07T10:00:00Z', seconds: 3 }
const gpu = { ...expected, instances: [{ name: 'pid_42_luid_A_phys_0', dedicatedBytes: 100, sharedBytes: 20, committedBytes: 150 }] }
test('VRAM requires exact process identity, fresh sample and raw instances', () => {
  assert.deepEqual(gpuInstances(gpu, expected), { dedicatedBytes: 100, sharedBytes: 20, committedBytes: 150 })
  for (const bad of [{ ...gpu, pid: 41 }, { ...gpu, processStart: 'other' }, { ...gpu, seconds: 0 }, { ...gpu, instances: [] },
    { ...gpu, instances: [{ ...gpu.instances[0], name: 'pid_41_luid_A_phys_0' }] }]) assert.equal(gpuInstances(bad, expected), null)
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
