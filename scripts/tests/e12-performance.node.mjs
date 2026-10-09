import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { EventEmitter } from 'node:events'
import { scopedE12Path, snapshotPayload, watchExit } from '../lib/e12-process.mjs'
import { nearestRank, timeMs, metricSummary, gpuInstances, probeVerdict, parseProbeCsv, validateGpuSeries, validateProbeIdentity, clockMetadataVerdict } from '../lib/e12-performance.mjs'

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
    ({ name, category: 'Render', unit: 'TimeNanoseconds', available: true, validAtEnd: true, sampleCount: 1, reads: 1 })) }
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

test('payload includes prototype-like filenames across addition replacement and deletion', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e12-payload-keys-'))
  const ordinary = path.join(directory, 'Player.exe'), special = path.join(directory, '__proto__')
  try {
    fs.writeFileSync(ordinary, 'player'); const baseline = JSON.stringify(snapshotPayload(directory))
    fs.writeFileSync(special, 'first'); const added = snapshotPayload(directory)
    assert.equal(Object.hasOwn(added, '__proto__'), true)
    assert.equal(JSON.parse(JSON.stringify(added)).__proto__.bytes, 5)
    assert.notEqual(JSON.stringify(added), baseline)
    fs.writeFileSync(special, 'other'); const replaced = JSON.stringify(snapshotPayload(directory))
    assert.notEqual(replaced, JSON.stringify(added))
    fs.unlinkSync(special); assert.equal(JSON.stringify(snapshotPayload(directory)), baseline)
    assert.notEqual(JSON.stringify(snapshotPayload(directory)), replaced)
  } finally {
    if (fs.existsSync(special)) fs.unlinkSync(special)
    fs.unlinkSync(ordinary); fs.rmdirSync(directory)
  }
})

test('counter identity rejects wrong category, wrong unit, duplicate and missing metadata', () => {
  const csv = 'frame,focus,minimized,cpuMainRaw,cpuRenderRaw,gpuRaw\n1,True,False,1000000,2000000,3000000'
  const valid = { name: 'GPU Frame Time', category: 'Render', unit: 'TimeNanoseconds', available: true, validAtEnd: true, sampleCount: 1, reads: 1 }
  const parse = counters => parseProbeCsv(csv, { frames: 1, counters })[0].gpuMs
  const wrongCategory = { ...valid, category: 'UI Toolkit' }
  assert.equal(parse([valid, wrongCategory]), 3)
  assert.equal(parse([wrongCategory, valid]), 3)
  for (const counters of [[], [wrongCategory], [{ ...valid, unit: 'Count' }], [valid, valid], [valid, { ...valid, unit: 'Count' }]])
    assert.equal(parse(counters), null)
})

test('GPU freshness keeps the 100ns boundary rather than truncating to milliseconds', () => {
  const sample = timestampUtc => ({ ...gpu, instances: [{ ...gpu.instances[0], timestampUtc }] })
  assert.notEqual(gpuInstances(sample('2026-10-07T10:00:03.3500000Z'), expected), null)
  assert.equal(gpuInstances(sample('2026-10-07T10:00:03.3500001Z'), expected), null)
  assert.notEqual(gpuInstances(sample('2026-10-07T10:00:01.0000000Z'), expected), null)
  assert.equal(gpuInstances(sample('2026-10-07T10:00:00.9999999Z'), expected), null)
})

test('duplicate adapters and unsafe aggregate values are rejected', () => {
  assert.equal(gpuInstances({ ...gpu, instances: [gpu.instances[0], gpu.instances[0]] }, expected), null)
  const second = { ...gpu.instances[0], name: 'pid_42_luid_B_phys_0', dedicatedBytes: Number.MAX_SAFE_INTEGER }
  assert.equal(gpuInstances({ ...gpu, instances: [gpu.instances[0], second] }, expected), null)
})

test('exact decimal bytes preserve values above the JS safe integer limit and reject signed overflow', () => {
  const instance = { ...gpu.instances[0], dedicatedBytes: '9007199254740993', sharedBytes: '20', committedBytes: '9007199254741093' }
  assert.equal(gpuInstances({ ...gpu, instances: [instance] }, expected).dedicatedBytes, '9007199254740993')
  for (const value of ['-1', '1.5', '01', '9223372036854775808'])
    assert.equal(gpuInstances({ ...gpu, instances: [{ ...instance, dedicatedBytes: value }] }, expected), null)
  assert.equal(gpuInstances({ ...gpu, instances: [instance, { ...instance, name: 'pid_42_luid_B_phys_0', dedicatedBytes: '9223372036854775807' }] }, expected), null)
})

test('series preserves sub-millisecond high-water marks and does not accept adapter changes', () => {
  const sample = (at, overrides = {}) => ({ ...gpu, instances: [{ ...gpu.instances[0], timestampUtc: `2026-10-07T10:00:03.${at}Z` }], ...overrides })
  assert.deepEqual(validateGpuSeries([sample('0000001'), sample('0000002'), sample('0000002'), sample('0000001')], expected).map(s => s.usage !== null), [true, true, false, false])
  const added = { ...gpu.instances[0], name: 'pid_42_luid_B_phys_0', timestampUtc: '2026-10-07T10:00:03.0000003Z' }
  assert.deepEqual(validateGpuSeries([sample('0000001'), sample('0000002', { instances: [added] }), sample('0000002')], expected).map(s => s.usage !== null), [true, false, true])
})

test('query duration and process identity retain 100ns precision; helper errors fail closed', () => {
  assert.equal(gpuInstances({ ...gpu, queryEndUtc: '2026-10-07T10:00:05.0000001Z' }, expected), null)
  assert.equal(gpuInstances({ ...gpu, processStart: '2026-10-07T10:00:00.0000001Z' }, expected), null)
  assert.equal(gpuInstances({ ...gpu, error: 'PID_REUSED' }, expected), null)
  assert.equal(gpuInstances({ ...gpu, utc: '2026-02-30T10:00:00Z' }, expected), null)
})

test('production clock decoder handles explicit zones and rejects DST ambiguity without provider access', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e12-clock-offline-'))
  const fixturePath = path.join(directory, 'fixtures.json'), output = path.join(directory, 'result.json')
  const raw = (iso, extra = 0n) => (BigInt(Date.parse(iso)) * 10000n + 116444736000000000n + extra).toString()
  const fixtures = [
    { id: 'taipei', raw: raw('2026-10-08T17:00:00Z', 1n), frequency: '10000000', zone: 'Taipei Standard Time' },
    { id: 'kolkata', raw: raw('2026-10-08T17:00:00Z'), frequency: '10000000', zone: 'India Standard Time' },
    { id: 'ambiguous', raw: raw('2026-11-01T01:30:00Z'), frequency: '10000000', zone: 'Eastern Standard Time' },
    { id: 'invalid', raw: raw('2026-03-08T02:30:00Z'), frequency: '10000000', zone: 'Eastern Standard Time' },
    { id: 'frequency', raw: '1', frequency: '0', zone: 'UTC' },
    { id: 'negative', raw: '-1', frequency: '10000000', zone: 'UTC' },
  ]
  try {
    fs.writeFileSync(fixturePath, JSON.stringify(fixtures))
    const script = fileURLToPath(new URL('../e12-gpu-telemetry.ps1', import.meta.url))
    const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Output', output, '-OfflineClockFixture', fixturePath], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    assert.equal(result.status, 0, result.error?.message ?? result.stderr)
    const rows = JSON.parse(fs.readFileSync(output, 'utf8'))
    assert.equal(rows[0].utc, '2026-10-08T09:00:00.0000001Z')
    assert.equal(rows[1].utc, '2026-10-08T11:30:00.0000000Z')
    assert.equal(rows[2].error, 'AMBIGUOUS_LOCAL_TIME')
    assert.equal(rows[3].error, 'INVALID_LOCAL_TIME')
    assert.equal(rows[4].error, 'UNKNOWN_CLOCK_FREQUENCY')
    assert.equal(rows[5].error, 'INVALID_SOURCE_FILETIME')
  } finally {
    for (const filename of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, filename))
    fs.rmdirSync(directory)
  }
})

test('schema 2 checks post-query Player identity, complete adapter keys, raw clock and source mapping', () => {
  const instance = { ...gpu.instances[0], name: 'pid_42_luid_0x00000000_0x00000ABC_phys_0', timestampSys100Ns: '134359176030000000', frequencySys100Ns: '10000000', dedicatedBytes: '100', sharedBytes: '20', committedBytes: '150' }
  const current = { ...gpu, schemaVersion: 2, pidAfter: 42, processStartAfter: expected.processStart, timezoneId: 'Taipei Standard Time', clockMapping: 'LOCAL_ENCODED_VALIDATED_SOURCE', instances: [instance] }
  assert.equal(gpuInstances(current, expected).dedicatedBytes, '100')
  for (const overrides of [{ pidAfter: 43 }, { processStartAfter: '2026-10-07T10:00:01Z' }, { timezoneId: '' }, { clockMapping: 'OBSERVED_SOURCE_REQUIRES_PLAYER_VALIDATION' }])
    assert.equal(gpuInstances({ ...current, ...overrides }, expected), null)
  for (const overrides of [{ name: 'pid_42_unknown' }, { timestampSys100Ns: 134359176030000000 }, { frequencySys100Ns: '0' }])
    assert.equal(gpuInstances({ ...current, instances: [{ ...instance, ...overrides }] }, expected), null)
  assert.equal(gpuInstances({ ...current, instances: [instance, { ...instance, name: 'pid_42_luid_0x0_0xabc_phys_00' }] }, expected), null)
})

test('memory CSV preserves exact decimal bytes and rejects malformed integers', () => {
  for (const field of ['privateBytes', 'workingSet', 'allocated', 'gcUsed', 'gcReserved', 'used']) {
    const parse = value => parseProbeCsv(`frame,focus,minimized,${field}\n1,True,False,${value}`, {})[0][field]
    assert.equal(parse('9007199254740993'), '9007199254740993', field)
    for (const value of ['-1', '1.5', '01', '9223372036854775808']) assert.throws(() => parse(value), /INVALID_CSV_BYTES/, field)
  }
})

const metadataExpected = { runId: 'metadata-run', sourceHead: 'a'.repeat(40), scriptSha256: 'b'.repeat(64) }
const metadataFixture = () => {
  const file = { path: 'C:/Windows/System32/fixture.dll', fileVersion: '1.0', sha256: 'c'.repeat(64) }
  return { ...metadataExpected, schemaVersion: 1, kind: 'PLAYER_CLOCK_METADATA_ONLY', maximumCimQueries: 4,
    counterWindows: 0, clockMapping: 'UNVERIFIED', gpuCounterProducerBinding: null,
    status: 'METADATA_OBSERVED_CLOCK_MAPPING_BLOCKED', error: 'GPU_COUNTER_PRODUCER_BINDING_UNPROVEN',
    queries: ['OS', 'GPU_DRIVERS', 'GPU_COUNTER_CLASS', 'WMI_BRIDGE_REGISTRATION', 'WMI_BRIDGE_INPROC_REGISTRY64', 'FIXED_SYSTEM_FILES']
      .map((name, i) => ({ name, elapsedMs: 1, startTick: String(i * 10), endTick: String(i * 10 + 1), frequency: '1000', error: null })),
    wmiBridgeIdentity: { name: 'WmiPerfInst', registeredDll: file, loadedModuleProven: false }, counterSchemaIdentity: {},
    environmentVersions: { os: { Version: '1', BuildNumber: '1' }, timezoneId: 'fixture', pdh: file, graphicsKernel: file,
      gpuDrivers: [{ Name: 'fixture', DriverVersion: '1', PNPDeviceID: 'fixture' }] } }
}
test('clock metadata cannot authorize Player, producer binding or a validated clock label', () => {
  const raw = metadataFixture()
  assert.deepEqual(clockMetadataVerdict(raw, metadataExpected), { status: 'BLOCKED_CLOCK_MAPPING', metadataObserved: true,
    clockMapping: 'UNVERIFIED', playerAllowed: false, counterWindows: 0, reasons: ['GPU_COUNTER_PRODUCER_BINDING_UNPROVEN'] })
  for (const override of [{ runId: 'other' }, { sourceHead: 'other' }, { scriptSha256: 'other' }, { counterWindows: 1 },
    { maximumCimQueries: 5 }, { status: 'PASS' }, { clockMapping: 'LOCAL_ENCODED_VALIDATED_SOURCE' }, { gpuCounterProducerBinding: { validated: true } }])
    assert.equal(clockMetadataVerdict({ ...raw, ...override }, metadataExpected).status, 'BLOCKED_INVALID_CLOCK_METADATA')
})
test('clock metadata enforces query ordering, failure stop and exact monotonic values', () => {
  const raw = metadataFixture()
  for (const queries of [[...raw.queries, raw.queries[0]], [raw.queries[1], ...raw.queries.slice(1)],
    raw.queries.map((q, i) => i === 0 ? { ...q, error: 'failed' } : q),
    raw.queries.map((q, i) => i === 0 ? { ...q, elapsedMs: 2000.0001 } : q),
    raw.queries.map((q, i) => i === 0 ? { ...q, frequency: '0' } : q),
    raw.queries.map((q, i) => i === 0 ? { ...q, endTick: '2001' } : q),
    raw.queries.map((q, i) => i === 0 ? { ...q, startTick: '9007199254740993', endTick: '9007199254740992' } : q)])
    assert.equal(clockMetadataVerdict({ ...raw, queries }, metadataExpected).status, 'BLOCKED_INVALID_CLOCK_METADATA')
  const partial = { ...raw, status: 'BLOCKED_METADATA', error: 'METADATA_SOURCE_DEADLINE',
    queries: [{ ...raw.queries[0], elapsedMs: 2001, error: 'METADATA_SOURCE_DEADLINE' }] }
  assert.equal(clockMetadataVerdict(partial, metadataExpected).metadataObserved, false)
  assert.equal(clockMetadataVerdict(partial, metadataExpected).playerAllowed, false)
})
test('registered bridge and environment cannot silently omit required version fields', () => {
  for (const change of [r => { r.wmiBridgeIdentity.registeredDll.fileVersion = '' }, r => { r.wmiBridgeIdentity.loadedModuleProven = true },
    r => { r.environmentVersions.gpuDrivers = [] }, r => { r.environmentVersions.os.BuildNumber = null },
    r => { r.environmentVersions.graphicsKernel = null }]) {
    const raw = metadataFixture(); change(raw)
    assert.equal(clockMetadataVerdict(raw, metadataExpected).status, 'BLOCKED_INVALID_CLOCK_METADATA')
  }
})
test('diagnostic syntax and existing native ABI compile offline without metadata or counter calls', () => {
  const script = fileURLToPath(new URL('../diagnostics/Capture-E12ClockComparison.ps1', import.meta.url))
  const command = `$errors=$null; $tokens=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:CHANGSHAN_CLOCK_SCRIPT,[ref]$tokens,[ref]$errors); if($errors.Count){throw ($errors | Out-String)}; $source=Get-Content -LiteralPath $env:CHANGSHAN_CLOCK_SCRIPT -Raw; $match=[regex]::Match($source,"(?s)Add-Type -TypeDefinition @'\\r?\\n(.*?)\\r?\\n'@"); if(-not $match.Success){throw "INTEROP_NOT_FOUND"}; Add-Type -TypeDefinition $match.Groups[1].Value; [E12ClockComparison.Native]::CheckLayout(); "OFFLINE_SYNTAX_ABI_PASS"`
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, env: { ...process.env, CHANGSHAN_CLOCK_SCRIPT: script } })
  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  assert.match(result.stdout, /OFFLINE_SYNTAX_ABI_PASS/)
})
