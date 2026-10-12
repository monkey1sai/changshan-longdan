import { utcTicks } from './e12-performance.mjs'
import { extendClockTimeline } from './e12-clock-contract.mjs'

const reject = reason => { throw new Error(reason) }
const requireValue = (condition, reason) => { if (!condition) reject(reason) }
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) ? BigInt(value) : null
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\0')
const ticks = value => typeof value === 'string' && value.length <= 28 ? utcTicks(value) : null

// Snapshot JSON-shaped data without invoking accessors. Cycles/shared objects are rejected.
function snapshot(input) {
  const seen = new Set(); let nodes = 0
  function copy(value, depth = 0) {
    requireValue(++nodes <= 20000 && depth <= 16, 'INPUT_BOUNDS')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'string') { requireValue(value.length <= 65536, 'INPUT_BOUNDS'); return value }
    if (typeof value === 'number') { requireValue(Number.isSafeInteger(value), 'INPUT_NUMBER'); return value }
    requireValue(typeof value === 'object' && !seen.has(value), 'INPUT_REFERENCE')
    seen.add(value)
    requireValue(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INPUT_OBJECT')
    const descriptors = Object.getOwnPropertyDescriptors(value)
    requireValue(Reflect.ownKeys(descriptors).every(key => typeof key === 'string'), 'INPUT_OBJECT')
    for (const descriptor of Object.values(descriptors)) requireValue('value' in descriptor, 'INPUT_ACCESSOR')
    if (Array.isArray(value)) {
      requireValue(value.length <= 1024 && Object.keys(descriptors).length === value.length + 1, 'INPUT_ARRAY')
      return Array.from({ length: value.length }, (_, i) => copy(descriptors[i].value, depth + 1))
    }
    const result = Object.create(null)
    for (const [key, descriptor] of Object.entries(descriptors)) result[key] = copy(descriptor.value, depth + 1)
    return result
  }
  return copy(input)
}
function bracket(query, processStart) {
  const start = ticks(query?.queryStartUtc), end = ticks(query?.queryEndUtc)
  const first = decimal(query?.startTick), last = decimal(query?.endTick), frequency = decimal(query?.frequency)
  requireValue(start !== null && end !== null && start >= processStart && end >= start && end - start <= 20000000n &&
    first !== null && last !== null && frequency !== null && frequency > 0n && last >= first &&
    (last - first) * 10000000n <= frequency * 20000000n, 'QUERY_WINDOW')
  const drift = (end - start) * frequency - (last - first) * 10000000n
  requireValue((drift < 0n ? -drift : drift) <= frequency * 2500000n, 'QUERY_DRIFT')
  return { start, end, first, last, frequency }
}
function identity(actual, expected) {
  requireValue(actual && ['pid', 'imageSha256', 'runId', 'fullBuildSha256'].every(key => actual[key] === expected[key]) &&
    ticks(actual.processStartUtc) === ticks(expected.processStartUtc), 'PLAYER_IDENTITY')
}
function buffer(size, data, unit, cap) {
  requireValue(size.status === 'MORE_DATA' && size.unit === unit && data.unit === unit &&
    Number.isSafeInteger(size.required) && size.required > 0 && size.required <= cap &&
    data.allocated === size.required && data.used === size.required, 'BUFFER_SIZE_OR_UNIT')
  if (unit === 'bytes') {
    requireValue(Array.isArray(data.strings) && data.strings.length === 1 && data.strings[0].text === data.path, 'BUFFER_STRING')
    const span = data.strings[0]
    requireValue(Number.isSafeInteger(span.offsetBytes) && span.offsetBytes >= 0 && span.offsetBytes % 2 === 0 &&
      text(span.text) && span.offsetBytes + (span.text.length + 1) * 2 <= data.used && span.terminated === true, 'BUFFER_POINTER_RANGE')
  } else {
    requireValue(typeof data.multiSz === 'string' && data.multiSz.length === data.used && data.multiSz.endsWith('\0\0'), 'BUFFER_MULTI_SZ')
  }
}
function instanceSet(paths, localized, expected) {
  requireValue(Array.isArray(paths) && paths.length >= 1 && paths.length <= 16, 'INSTANCE_COUNT')
  const prefix = `\\${localized.object}(`, suffix = `)\\${localized.counter}`
  const names = new Set(), adapters = new Set()
  return paths.map(path => {
    requireValue(typeof path === 'string' && path.startsWith(prefix) && path.endsWith(suffix), 'COUNTER_PATH')
    const name = path.slice(prefix.length, -suffix.length)
    const match = new RegExp(`^pid_${expected.pid}_luid_(0x[0-9a-fA-F]{1,8})_(0x[0-9a-fA-F]{1,8})_phys_([0-9]{1,10})$`).exec(name)
    requireValue(match && BigInt(match[3]) <= 4294967295n, 'INSTANCE_IDENTITY')
    const adapter = `${BigInt(match[1])}:${BigInt(match[2])}:${BigInt(match[3])}`
    requireValue(!names.has(name) && !adapters.has(adapter), 'DUPLICATE_INSTANCE')
    names.add(name); adapters.add(adapter)
    return { name, adapter, path }
  })
}
function windowContract(window, expected, previous, timeline, previousSet) {
  const start = ticks(expected.processStartUtc)
  identity(window.before, expected); identity(window.after, expected)
  requireValue(window.schemaVersion === 1 && window.fingerprintSha256 === expected.fingerprintSha256 &&
    window.timezoneId === expected.timezoneId && window.utcOffsetTicks === expected.utcOffsetTicks &&
    window.decodeStatus === 'UNAMBIGUOUS_LOCAL_TO_UTC', 'ENVIRONMENT_OR_DECODE')
  const whole = bracket(window.query, start)
  const steps = window.trace
  requireValue(Array.isArray(steps) && steps.length > 0 && steps.length <= 75, 'TRACE_BOUNDS')
  let queryHandle = null, failed = false
  const usedHandles = new Set()
  for (const step of steps) {
    requireValue(text(step.op) && ['SUCCESS', 'MORE_DATA', 'ERROR'].includes(step.status), 'API_STATUS')
    if (failed) requireValue(step.op === 'CloseQuery' && step.handle === queryHandle && queryHandle !== null, 'FAIL_STOP')
    if (step.op === 'OpenQuery') {
      requireValue(queryHandle === null && usedHandles.size === 0, 'HANDLE_LIFECYCLE')
      if (step.status === 'SUCCESS') { requireValue(text(step.handle), 'HANDLE_LIFECYCLE'); queryHandle = step.handle; usedHandles.add(step.handle) }
    } else if (step.op === 'CloseQuery') {
      requireValue(queryHandle !== null && step.handle === queryHandle, 'HANDLE_LIFECYCLE'); queryHandle = null
    } else requireValue(queryHandle !== null, 'HANDLE_LIFECYCLE')
    if (step.status === 'ERROR' || (step.status === 'MORE_DATA' && !step.op.endsWith('Size'))) failed = true
    const interval = bracket(step.query, start)
    requireValue(interval.start >= whole.start && interval.end <= whole.end && interval.first >= whole.first &&
      interval.last <= whole.last && interval.frequency === whole.frequency, 'API_OUTSIDE_WINDOW')
  }
  requireValue(queryHandle === null && window.checkpointSaved === true, 'CLEANUP_OR_CHECKPOINT')
  requireValue(!failed, 'SOURCE_ERROR')
  let index = 0
  function take(op, handle = null, status = 'SUCCESS') {
    const step = steps[index++]
    requireValue(step?.op === op && step.status === status && (handle === null || step.handle === handle), 'API_SEQUENCE')
    return step
  }
  const query = take('OpenQuery').handle
  const wildcard = take('AddEnglish')
  requireValue(wildcard.queryHandle === query && text(wildcard.handle) && !usedHandles.has(wildcard.handle) &&
    wildcard.path === `\\GPU Process Memory(pid_${expected.pid}_*)\\Dedicated Usage`, 'ENGLISH_PATH_OR_HANDLE')
  usedHandles.add(wildcard.handle)
  const infoSize = take('InfoSize', wildcard.handle, 'MORE_DATA'), info = take('InfoData', wildcard.handle)
  buffer(infoSize, info, 'bytes', 65536)
  const localized = window.localized
  requireValue(localized && text(localized.object) && text(localized.counter) &&
    !/[\\()*#]/.test(localized.object + localized.counter) && info.counterType === 65792 &&
    info.path === `\\${localized.object}(pid_${expected.pid}_*)\\${localized.counter}`, 'LOCALIZED_MAPPING')
  function expand() {
    const size = take('ExpandSize', wildcard.handle, 'MORE_DATA'), data = take('ExpandData', wildcard.handle)
    buffer(size, data, 'utf16', 32768)
    requireValue(data.path === info.path && Array.isArray(data.paths) && data.multiSz === data.paths.join('\0') + '\0\0', 'EXPANSION_CONTENT')
    return instanceSet(data.paths, localized, expected)
  }
  const before = expand()
  take('RemoveCounter', wildcard.handle)
  const handles = []
  for (const item of before) {
    const add = take('AddCounter')
    requireValue(add.queryHandle === query && add.path === item.path && text(add.handle) && !usedHandles.has(add.handle), 'COUNTER_HANDLE')
    usedHandles.add(add.handle); handles.push(add.handle)
    const size = take('InfoSize', add.handle, 'MORE_DATA'), data = take('InfoData', add.handle)
    buffer(size, data, 'bytes', 65536)
    requireValue(data.path === item.path && data.counterType === 65792, 'COUNTER_METADATA')
  }
  take('Collect', query)
  const next = new Map(previous)
  for (let n = 0; n < before.length; n++) {
    const raw = take('Raw', handles[n]), at = ticks(raw.timestampUtc), source = decimal(raw.rawTimestamp)
    requireValue(raw.name === before[n].name && raw.counterType === 65792 && [0, 1].includes(raw.cStatus) &&
      raw.decodeStatus === 'UNAMBIGUOUS_LOCAL_TO_UTC' && raw.utcOffsetTicks === expected.utcOffsetTicks &&
      raw.frequency === '10000000' && source !== null && source <= 2650467743999999999n && at !== null, 'RAW_STATUS_OR_DECODE')
    const interval = bracket(raw.query, start)
    requireValue(at >= start, 'SOURCE_BEFORE_PROCESS')
    requireValue(at >= interval.start - 20000000n && at <= interval.end + 2500000n, 'SOURCE_FRESHNESS')
    requireValue(source - 116444736000000000n - BigInt(expected.utcOffsetTicks) === at, 'RAW_DECODE_MISMATCH')
    const prior = previous.get(before[n].adapter)
    requireValue(prior === undefined || at > prior, 'SOURCE_HIGH_WATER')
    next.set(before[n].adapter, at)
  }
  const after = expand()
  const keys = before.map(item => item.adapter).sort().join('|')
  requireValue(keys === after.map(item => item.adapter).sort().join('|') &&
    before.map(item => item.name).sort().join('|') === after.map(item => item.name).sort().join('|') &&
    (previousSet === null || previousSet === keys), 'INSTANCE_COLLECTION_CHANGED')
  take('CloseQuery', query)
  requireValue(index === steps.length && index === 11 + 4 * before.length, 'API_CALL_COUNT')
  // All provenance, buffer spans and saved/cleanup markers above remain caller claims.
  let nextTimeline = extendClockTimeline([{ ...window.query, queryEndUtc: window.query.queryStartUtc, endTick: window.query.startTick }], timeline)
  nextTimeline = extendClockTimeline(steps.map(step => step.query), nextTimeline)
  nextTimeline = extendClockTimeline([{ ...window.query, queryStartUtc: window.query.queryEndUtc, startTick: window.query.endTick }], nextTimeline)
  return { highWater: next, timeline: nextTimeline, keys }
}

/** Pure offline consistency check. Never a native/clock/VRAM execution or approval gate. */
export function validatePdhSourceSeries(windows, expected) {
  const result = { status: 'BLOCKED_PDH_CONTRACT', executionVerified: false, formalVram: false,
    acceptedWindows: 0, failedIndex: null, reason: null, highWater: [] }
  let highWater = new Map(), timeline = null, keys = null
  try {
    const input = snapshot({ windows, expected }); windows = input.windows; expected = input.expected
    requireValue(Array.isArray(windows) && windows.length > 0 && windows.length <= 3, 'SERIES_BOUNDS')
    requireValue(expected && Number.isSafeInteger(expected.pid) && expected.pid > 0 && expected.pid <= 4294967295 && ticks(expected.processStartUtc) !== null &&
      ['imageSha256', 'fullBuildSha256', 'fingerprintSha256'].every(key => hash(expected[key])) &&
      typeof expected.runId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(expected.runId) && text(expected.timezoneId) &&
      typeof expected.utcOffsetTicks === 'string' && /^-?(0|[1-9][0-9]{0,11})$/.test(expected.utcOffsetTicks) &&
      BigInt(expected.utcOffsetTicks) >= -504000000000n && BigInt(expected.utcOffsetTicks) <= 504000000000n, 'EXPECTED_IDENTITY')
    for (let i = 0; i < windows.length; i++) {
      result.failedIndex = i
      const next = windowContract(windows[i], expected, highWater, timeline, keys)
      highWater = next.highWater; timeline = next.timeline; keys = next.keys
      result.acceptedWindows++
      result.highWater = [...highWater].map(([adapter, at]) => ({ adapter, timestampTicks: at.toString() }))
    }
    result.status = 'OFFLINE_CONTRACT_ACCEPTED'; result.failedIndex = null
  } catch (error) { result.reason = error instanceof Error ? error.message : 'INVALID_INPUT' }
  return result
}
