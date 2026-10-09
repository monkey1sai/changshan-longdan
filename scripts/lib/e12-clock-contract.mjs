import { utcTicks } from './e12-performance.mjs'

// Clock-only evidence. Values and byte units deliberately have no role in this decision.
// Decoding/DST and environment provenance must be verified by the eventual capture controller.
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null
function queryWindow(query, processStart) {
  const start = utcTicks(query?.queryStartUtc), end = utcTicks(query?.queryEndUtc)
  if (start === null || end === null || start < processStart || end < start || end - start > 20000000n) return null
  const monoStart = decimal(query.startTick), monoEnd = decimal(query.endTick), frequency = decimal(query.frequency)
  if (monoStart === null || monoEnd === null || frequency === null || frequency <= 0n || monoEnd < monoStart ||
    (monoEnd - monoStart) * 1000n > frequency * 2000n) return null
  const drift = (end - start) * frequency - (monoEnd - monoStart) * 10000000n
  return (drift < 0n ? -drift : drift) <= frequency * 2500000n ? { start, end } : null
}
export function clockWindowVerdict(window, expected, previous = new Map()) {
  const blocked = reason => ({ status: 'BLOCKED_CLOCK_WINDOW', reason })
  const processStart = utcTicks(expected?.processStartUtc)
  if (!expected || !Number.isSafeInteger(expected.pid) || expected.pid <= 0 || processStart === null ||
    !/^[a-f0-9]{64}$/.test(expected.imageSha256 ?? '') || !expected.runId || !/^[a-f0-9]{64}$/.test(expected.fingerprintSha256 ?? ''))
    return blocked('EXPECTED_IDENTITY')
  for (const identity of [window?.before, window?.after]) {
    if (!identity || identity.pid !== expected.pid || utcTicks(identity.processStartUtc) !== processStart ||
      identity.imageSha256 !== expected.imageSha256 || identity.runId !== expected.runId)
      return blocked('PLAYER_IDENTITY')
  }
  if (window.fingerprintSha256 !== expected.fingerprintSha256 || window.mappingHypothesis !== 'LOCAL_ENCODED_PREDECLARED' ||
    window.timezoneId !== expected.timezoneId || !expected.timezoneId) return blocked('ENVIRONMENT_OR_HYPOTHESIS')
  if (window.error) return blocked('SOURCE_ERROR')
  if (!Array.isArray(window.instances) || window.instances.length === 0 || window.instances.length > 16 || window.completeCollection !== true)
    return blocked('INCOMPLETE_COLLECTION')
  if (window.schemaVersion === 2 && (!Array.isArray(window.wmiRaw) || window.wmiRaw.length !== window.instances.length ||
    window.wmiRaw.some((raw,index)=>raw.name!==window.instances[index].name || raw.timestampSys100NS!==window.instances[index].wmi?.rawTimestamp ||
      raw.frequencySys100NS!==window.instances[index].wmi?.frequency))) return blocked('WMI_RAW_COLLECTION_MISMATCH')
  const next = new Map(previous), names = new Set(), adapters = new Set()
  for (const instance of window.instances) {
    const match = new RegExp(`^pid_${expected.pid}_luid_(0x[0-9a-fA-F]+)_(0x[0-9a-fA-F]+)_phys_([0-9]+)$`).exec(instance.name ?? '')
    if (!match) return blocked('INSTANCE_IDENTITY')
    const adapter = `${BigInt(match[1])}:${BigInt(match[2])}:${BigInt(match[3])}`
    if (names.has(instance.name) || adapters.has(adapter)) return blocked('DUPLICATE_INSTANCE')
    names.add(instance.name); adapters.add(adapter)
    for (const source of ['wmi', 'pdh']) {
      const sample = instance[source], timestamp = utcTicks(sample?.timestampUtc), raw = decimal(sample?.rawTimestamp)
      const query = queryWindow(window.schemaVersion === 2 ? sample?.query : window, processStart)
      if (!query) return blocked('SOURCE_QUERY_WINDOW')
      if (!sample || sample.apiStatus !== 0 || (source === 'pdh' && sample.counterType !== 65792) || raw === null || raw > 2650467743999999999n ||
        sample.frequency !== '10000000' || sample.decodeStatus !== 'UNAMBIGUOUS_LOCAL_TO_UTC' ||
        (source === 'pdh' && sample.cStatus !== 0 && sample.cStatus !== 1)) return blocked('SOURCE_STATUS_OR_DECODE')
      if (timestamp === null || timestamp < query.start - 20000000n || timestamp > query.end + 2500000n)
        return blocked('SOURCE_NOT_FRESH_AGAINST_UTC')
      if (typeof sample.utcOffsetTicks !== 'string' || !/^-?(0|[1-9][0-9]*)$/.test(sample.utcOffsetTicks))
        return blocked('SOURCE_OFFSET')
      const offset = BigInt(sample.utcOffsetTicks)
      if (offset < -504000000000n || offset > 504000000000n || raw - 116444736000000000n - offset !== timestamp)
        return blocked('RAW_DECODE_MISMATCH')
      const key = `${adapter}:${source}`, prior = previous.get(key)
      if (prior !== undefined && timestamp <= prior) return blocked('SOURCE_HIGH_WATER')
      next.set(key, timestamp)
    }
  }
  if (previous.size && (next.size !== previous.size || [...previous.keys()].some(key => ![...adapters].some(adapter => key === `${adapter}:wmi` || key === `${adapter}:pdh`))))
    return blocked('INSTANCE_COLLECTION_CHANGED')
  return { status: 'PASS_CLOCK_WINDOW_ONLY', highWater: next }
}

// Bracket snapshots prove equality at their observation points, not continuous stability or loaded modules.
export function fingerprintContents(record) {
  if (record?.status !== 'PASS_ENVIRONMENT_FINGERPRINT_ONLY' || record.steps?.length !== 4 || record.error ||
    record.steps.some((step, i) => step.name !== ['os', 'gpu', 'apiFiles', 'timezone'][i] || step.error || !Array.isArray(step.raw) || !step.raw.length))
    throw new Error('INVALID_ENVIRONMENT_SNAPSHOT')
  return { os: record.steps[0].raw, gpu: [...record.steps[1].raw].sort((a,b) => a.PNPDeviceID.localeCompare(b.PNPDeviceID)),
    apiFiles: record.steps[2].raw, timezone: record.steps[3].raw }
}
export function validateClockReady(report, identity, end = false) {
  if (!report || report.status !== (end ? 'STOPPED_CLOCK_ONLY' : 'READY_CLOCK_ONLY') || report.runId !== identity.runId ||
    report.pid !== identity.pid || utcTicks(report.processStartUtc) !== utcTicks(identity.processStartUtc) || utcTicks(report.processStartUtc) === null ||
    report.graphicsApi !== 'Direct3D11' || report.width !== 1920 || report.height !== 1080 || report.assetStatus !== 'Ready' ||
    !Number.isInteger(report.framesSinceEntry) || report.framesSinceEntry < 120 || report.errorCount !== 0 ||
    report.development !== true || report.batchMode !== false || report.focused !== true ||
    utcTicks(report.utc) === null || decimal(report.monotonicTick) === null || decimal(report.frequency) === null || BigInt(report.frequency) <= 0n)
    throw new Error('INVALID_CLOCK_READY')
  return report
}
export function extendClockTimeline(queries, previous = null) {
  let state = previous ? { ...previous } : null
  for (const query of queries) {
    for (const [utc, tick] of [[query?.queryStartUtc,query?.startTick],[query?.queryEndUtc,query?.endTick]]) {
      const time = utcTicks(utc), counter = decimal(tick), frequency = decimal(query?.frequency)
      if (time === null || counter === null || frequency === null || frequency <= 0n) throw new Error('INVALID_CLOCK_TIMELINE')
      if (!state) state = {utc:time,tick:counter,frequency,lastTick:counter}
      if (frequency !== state.frequency || counter < state.lastTick) throw new Error('CLOCK_TIMELINE_REVERSED')
      const drift = (time-state.utc)*frequency-(counter-state.tick)*10000000n
      if ((drift<0n?-drift:drift)>frequency*2500000n) throw new Error('CLOCK_TIMELINE_DISCONTINUITY')
      state.lastTick=counter
    }
  }
  return state
}
