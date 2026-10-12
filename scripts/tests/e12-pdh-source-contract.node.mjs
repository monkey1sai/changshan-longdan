import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePdhSourceSeries } from '../lib/e12-pdh-source-contract.mjs'
import { utcTicks } from '../lib/e12-performance.mjs'

const clone = value => structuredClone(value)
const expected = { pid: 12, processStartUtc: '2026-10-12T01:00:00Z', imageSha256: 'a'.repeat(64),
  fullBuildSha256: 'b'.repeat(64), fingerprintSha256: 'c'.repeat(64), runId: '00000000-0000-4000-8000-000000000001',
  timezoneId: 'Taipei Standard Time', utcOffsetTicks: '288000000000' }
const epoch = utcTicks('2026-10-12T01:00:10Z')
function utc(value) {
  const seconds = value / 10000000n, fraction = value % 10000000n
  return new Date(Number(seconds * 1000n)).toISOString().slice(0, 19) + '.' + fraction.toString().padStart(7, '0') + 'Z'
}
function query(at = epoch, duration = 0n, frequency = 10000000n) {
  const first = (at - epoch + 1000000000n) * frequency / 10000000n
  return { queryStartUtc: utc(at), queryEndUtc: utc(at + duration), startTick: first.toString(),
    endTick: (first + duration * frequency / 10000000n).toString(), frequency: frequency.toString() }
}
function fixture(at = epoch, count = 2, identity = expected) {
  const localized = { object: 'GPU 程序記憶體', counter: '專用使用量' }
  const path = name => `\\${localized.object}(${name})\\${localized.counter}`
  const names = Array.from({ length: count }, (_, i) => `pid_${identity.pid}_luid_0x0_0x${i + 1}_phys_0`)
  const paths = names.map(path), wildcardPath = path(`pid_${identity.pid}_*`), trace = []
  const add = (op, handle, fields = {}) => trace.push({ op, handle, status: 'SUCCESS', query: query(at), ...fields })
  function info(handle, fullPath) {
    const size = (fullPath.length + 1) * 2 + 64
    add('InfoSize', handle, { status: 'MORE_DATA', unit: 'bytes', required: size })
    add('InfoData', handle, { unit: 'bytes', allocated: size, used: size, path: fullPath, counterType: 65792,
      strings: [{ text: fullPath, offsetBytes: 64, terminated: true }] })
  }
  function expand() {
    const multiSz = paths.join('\0') + '\0\0'
    add('ExpandSize', 'wildcard', { status: 'MORE_DATA', unit: 'utf16', required: multiSz.length })
    add('ExpandData', 'wildcard', { unit: 'utf16', allocated: multiSz.length, used: multiSz.length,
      path: wildcardPath, paths: clone(paths), multiSz })
  }
  add('OpenQuery', 'query')
  add('AddEnglish', 'wildcard', { queryHandle: 'query', path: `\\GPU Process Memory(pid_${identity.pid}_*)\\Dedicated Usage` })
  info('wildcard', wildcardPath); expand(); add('RemoveCounter', 'wildcard')
  for (let i = 0; i < count; i++) { add('AddCounter', `counter-${i}`, { queryHandle: 'query', path: paths[i] }); info(`counter-${i}`, paths[i]) }
  add('Collect', 'query')
  for (let i = 0; i < count; i++) add('Raw', `counter-${i}`, { name: names[i], counterType: 65792, cStatus: i % 2,
    rawTimestamp: (at + 116444736000000000n + BigInt(expected.utcOffsetTicks)).toString(), timestampUtc: utc(at),
    frequency: '10000000', decodeStatus: 'UNAMBIGUOUS_LOCAL_TO_UTC', utcOffsetTicks: expected.utcOffsetTicks })
  expand(); add('CloseQuery', 'query')
  return { schemaVersion: 1, before: clone(identity), after: clone(identity), fingerprintSha256: identity.fingerprintSha256,
    timezoneId: expected.timezoneId, utcOffsetTicks: expected.utcOffsetTicks, decodeStatus: 'UNAMBIGUOUS_LOCAL_TO_UTC',
    localized, query: query(at, 10000n), trace, checkpointSaved: true }
}
const verdict = (window, identity = expected) => validatePdhSourceSeries([window], identity)
function blocked(window, reason) { const r = verdict(window); assert.equal(r.status, 'BLOCKED_PDH_CONTRACT'); if (reason) assert.equal(r.reason, reason); return r }
function sampleAt(step, at) {
  step.timestampUtc = utc(at)
  step.rawTimestamp = (at + 116444736000000000n + BigInt(expected.utcOffsetTicks)).toString()
}

test('empty offline input cannot establish a PDH source', () => {
  const result = validatePdhSourceSeries([], {})
  assert.equal(result.status, 'BLOCKED_PDH_CONTRACT')
  assert.equal(result.executionVerified, false)
  assert.equal(result.formalVram, false)
})

test('two localized adapter mocks are accepted only as offline consistency, never execution or VRAM', () => {
  const windows = [fixture(), fixture(epoch + 10000000n)]
  const before = clone(windows), identity = clone(expected)
  const result = validatePdhSourceSeries(windows, expected)
  assert.equal(result.status, 'OFFLINE_CONTRACT_ACCEPTED', result.reason)
  assert.equal(result.acceptedWindows, 2); assert.equal(result.executionVerified, false); assert.equal(result.formalVram, false)
  assert.deepEqual(windows, before); assert.deepEqual(expected, identity)
  assert.equal(verdict(fixture(epoch, 16)).status, 'OFFLINE_CONTRACT_ACCEPTED')
})

for (const [label, change] of [
  ['wrong process', w => { w.before.pid = 123 }], ['PID reuse', w => { w.after.processStartUtc = utc(epoch) }],
  ['wrong build', w => { w.after.fullBuildSha256 = 'd'.repeat(64) }], ['wrong run', w => { w.before.runId = 'other' }],
  ['wrong fingerprint', w => { w.fingerprintSha256 = 'd'.repeat(64) }], ['wrong zone', w => { w.timezoneId = 'UTC' }],
  ['DST ambiguous', w => { w.decodeStatus = 'AMBIGUOUS' }], ['checkpoint absent', w => { w.checkpointSaved = false }],
  ['remote English path', w => { w.trace[1].path = '\\\\other' + w.trace[1].path }],
  ['handle reused', w => { w.trace.find(s => s.op === 'AddCounter').handle = 'query' }],
  ['foreign cleanup', w => { w.trace.at(-1).handle = 'foreign' }], ['missing cleanup', w => { w.trace.pop() }],
  ['missing raw', w => { w.trace.splice(w.trace.findIndex(s => s.op === 'Raw'), 1) }],
  ['unknown counter type', w => { w.trace.find(s => s.op === 'Raw').counterType = 0 }],
  ['NO_INSTANCE despite API success', w => { w.trace.find(s => s.op === 'Raw').cStatus = 0x800007d1 }],
  ['raw decode mismatch', w => { w.trace.find(s => s.op === 'Raw').rawTimestamp = '1' }],
  ['missing timestamp', w => { delete w.trace.find(s => s.op === 'Raw').timestampUtc }],
  ['wrong source frequency', w => { w.trace.find(s => s.op === 'Raw').frequency = '1000' }],
  ['unknown raw decode', w => { w.trace.find(s => s.op === 'Raw').decodeStatus = 'UNKNOWN' }],
  ['different offset', w => { w.trace.find(s => s.op === 'Raw').utcOffsetTicks = '0' }],
  ['counter metadata mismatch', w => { w.trace.filter(s => s.op === 'InfoData')[1].counterType = 0 }],
  ['extra call', w => { w.trace.push(clone(w.trace.at(-1))) }],
]) test(`mock rejects ${label}`, () => { blocked(changeFixture(change)) })
function changeFixture(change) { const w = fixture(); change(w); return w }

for (const [label, change] of [
  ['bytes confused with UTF16', s => { s.unit = 'bytes' }], ['buffer resized', s => { s.allocated++ }],
  ['truncated buffer', s => { s.used-- }], ['missing double terminator', s => { s.multiSz = s.multiSz.slice(0, -1) }],
  ['PID prefix collision', s => { s.paths[0] = s.paths[0].replace('pid_12_', 'pid_123_'); s.multiSz = s.paths.join('\0') + '\0\0'; s.allocated = s.used = s.multiSz.length }],
  ['instance index', s => { s.paths[0] = s.paths[0].replace('phys_0)', 'phys_0#1)'); s.multiSz = s.paths.join('\0') + '\0\0'; s.allocated = s.used = s.multiSz.length }],
  ['parent instance', s => { s.paths[0] = s.paths[0].replace('(pid_', '(parent/pid_'); s.multiSz = s.paths.join('\0') + '\0\0'; s.allocated = s.used = s.multiSz.length }],
  ['canonical duplicate', s => { s.paths[1] = s.paths[0].replace('0x1', '0x01'); s.multiSz = s.paths.join('\0') + '\0\0'; s.allocated = s.used = s.multiSz.length }],
]) test(`mock buffer/set rejects ${label}`, () => {
  const w = fixture(), data = w.trace.find(s => s.op === 'ExpandData'); change(data)
  w.trace.find(s => s.op === 'ExpandSize').required = data.allocated
  blocked(w)
})

test('mock pointer and metadata size caps reject overrun and data expansion requests', () => {
  for (const change of [s => { s.strings[0].offsetBytes++ }, s => { s.strings[0].offsetBytes = s.used },
    s => { s.strings[0].terminated = false }, s => { s.status = 'MORE_DATA' }]) {
    const w = fixture(); change(w.trace.find(s => s.op === 'InfoData')); blocked(w)
  }
  for (const [op, required] of [['InfoSize', 65537], ['ExpandSize', 32769], ['InfoSize', 0]]) {
    const w = fixture(); w.trace.find(s => s.op === op).required = required; blocked(w)
  }
  blocked(fixture(epoch, 17)); blocked(fixture(epoch, 0))
})

test('first source failure allows only owned cleanup, including failed Open without Close', () => {
  const w = fixture(), close = clone(w.trace.at(-1))
  for (let i = 0; i < w.trace.length; i++) {
    const failed = clone(w); failed.trace[i].status = 'ERROR'
    failed.trace = failed.trace.slice(0, i + 1)
    if (i > 0 && failed.trace.at(-1).op !== 'CloseQuery') failed.trace.push(clone(close))
    assert.equal(blocked(failed).reason, 'SOURCE_ERROR', `failure at ${i}`)
  }
  const continued = clone(w); continued.trace[1].status = 'ERROR'; blocked(continued, 'FAIL_STOP')
  const nonexistent = clone(w); nonexistent.trace = [clone(w.trace[0]), close]; nonexistent.trace[0].status = 'ERROR'
  blocked(nonexistent, 'FAIL_STOP')
})

test('100ns freshness boundaries keep exact lag and future limits', () => {
  for (const [delta, accepted] of [[-20000000n, true], [-20000001n, false], [2500000n, true], [2500001n, false]]) {
    const w = fixture(); sampleAt(w.trace.find(s => s.op === 'Raw'), epoch + delta)
    assert.equal(verdict(w).status, accepted ? 'OFFLINE_CONTRACT_ACCEPTED' : 'BLOCKED_PDH_CONTRACT', String(delta))
  }
})

test('mock source cannot predate its bound process even inside the 2s freshness allowance', () => {
  const identity = { ...expected, processStartUtc: utc(epoch) }
  for (const [delta, accepted] of [[0n, true], [-1n, false], [-10000000n, false]]) {
    const w = fixture(); w.before = clone(identity); w.after = clone(identity)
    sampleAt(w.trace.find(s => s.op === 'Raw'), epoch + delta)
    const result = verdict(w, identity)
    assert.equal(result.status, accepted ? 'OFFLINE_CONTRACT_ACCEPTED' : 'BLOCKED_PDH_CONTRACT')
    if (!accepted) { assert.equal(result.reason, 'SOURCE_BEFORE_PROCESS'); assert.deepEqual(result.highWater, []) }
  }
})

test('mock identity respects the Windows PID DWORD boundaries even when all fields agree', () => {
  for (const [pid, accepted] of [[1, true], [4294967295, true], [0, false], [4294967296, false]]) {
    const identity = { ...expected, pid }, result = verdict(fixture(epoch, 2, identity), identity)
    assert.equal(result.status, accepted ? 'OFFLINE_CONTRACT_ACCEPTED' : 'BLOCKED_PDH_CONTRACT', String(pid))
    if (!accepted) { assert.equal(result.reason, 'EXPECTED_IDENTITY'); assert.deepEqual(result.highWater, []) }
  }
})

test('whole and per-call windows enforce exact 2s and enclosed monotonic/UTC intervals', () => {
  const w = fixture(); w.query = query(epoch, 20000000n)
  assert.equal(verdict(w).status, 'OFFLINE_CONTRACT_ACCEPTED')
  w.query = query(epoch, 20000001n); blocked(w, 'QUERY_WINDOW')
  for (const q of [query(epoch - 1n), query(epoch + 10001n), query(epoch, 0n, 1000n)]) {
    const bad = fixture(); bad.trace[4].query = q; blocked(bad)
  }
  for (const [delta, accepted] of [[2500000n, true], [2500001n, false]]) {
    const bad = fixture(); bad.query = query(epoch, 10000000n); bad.query.endTick = (BigInt(bad.query.endTick) + delta).toString()
    assert.equal(verdict(bad).status, accepted ? 'OFFLINE_CONTRACT_ACCEPTED' : 'BLOCKED_PDH_CONTRACT')
  }
})

test('failed series preserves only valid prefix and does not advance high water or accept later windows', () => {
  const good = fixture(), bad = fixture(epoch + 10000000n), later = fixture(epoch + 20000000n)
  sampleAt(bad.trace.find(s => s.op === 'Raw'), epoch)
  const result = validatePdhSourceSeries([good, bad, later], expected)
  assert.equal(result.status, 'BLOCKED_PDH_CONTRACT'); assert.equal(result.acceptedWindows, 1); assert.equal(result.failedIndex, 1)
  assert.equal(result.reason, 'SOURCE_HIGH_WATER'); assert.deepEqual(result.highWater, verdict(good).highWater)
})

test('mock cross-window set, frequency and timeline discontinuities are rejected', () => {
  const good = fixture()
  const changed = fixture(epoch + 10000000n, 1)
  assert.equal(validatePdhSourceSeries([good, changed], expected).reason, 'INSTANCE_COLLECTION_CHANGED')
  const reversed = fixture(epoch - 10000000n)
  assert.equal(validatePdhSourceSeries([good, reversed], expected).status, 'BLOCKED_PDH_CONTRACT')
  const drift = fixture(epoch + 10000000n)
  for (const q of [drift.query, ...drift.trace.map(s => s.query)]) { q.startTick = (BigInt(q.startTick) + 2500001n).toString(); q.endTick = (BigInt(q.endTick) + 2500001n).toString() }
  assert.equal(validatePdhSourceSeries([good, drift], expected).reason, 'CLOCK_TIMELINE_DISCONTINUITY')
})

test('mock after-enumeration changes do not masquerade as complete collection', () => {
  const w = fixture(), after = w.trace.filter(s => s.op === 'ExpandData').at(-1)
  after.paths = after.paths.slice(0, 1); after.multiSz = after.paths.join('\0') + '\0\0'; after.used = after.allocated = after.multiSz.length
  w.trace.filter(s => s.op === 'ExpandSize').at(-1).required = after.used
  blocked(w, 'INSTANCE_COLLECTION_CHANGED')
})

test('untrusted JSON shapes, accessors, shared references, missing identity and nonfinite numbers are blocked', () => {
  for (const invalid of [null, {}, '', Infinity, 1.5, { ...expected, pid: '12' }, { ...expected, pid: 4294967296 },
    { ...expected, runId: '-'.repeat(36) }, { ...expected, fullBuildSha256: null }])
    assert.equal(verdict(fixture(), invalid).status, 'BLOCKED_PDH_CONTRACT')
  const w = fixture(); w.after = w.before; blocked(w, 'INPUT_REFERENCE')
  let reads = 0; const getter = fixture()
  Object.defineProperty(getter, 'trace', { get() { reads++; return [] }, enumerable: true })
  blocked(getter, 'INPUT_ACCESSOR'); assert.equal(reads, 0)
  const hole = fixture(); delete hole.trace[0]; blocked(hole, 'INPUT_ARRAY')
  const circular = fixture(); circular.self = circular; blocked(circular, 'INPUT_REFERENCE')
  const forged = fixture(); forged.executionVerified = true; forged.formalVram = true
  const result = verdict(forged); assert.equal(result.executionVerified, false); assert.equal(result.formalVram, false)
})
