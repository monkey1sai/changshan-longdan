import { utcTicks } from './e12-performance.mjs'

// Clock-only evidence. Values and byte units deliberately have no role in this decision.
// Decoding/DST and environment provenance must be verified by the eventual capture controller.
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null
export function clockWindowVerdict(window, expected, previous = new Map()) {
  const blocked = reason => ({ status: 'BLOCKED_CLOCK_WINDOW', reason })
  const start = utcTicks(window?.queryStartUtc), end = utcTicks(window?.queryEndUtc)
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
  if (start === null || end === null || start < processStart || end < start || end - start > 20000000n)
    return blocked('UTC_QUERY_WINDOW')
  const monoStart = decimal(window.startTick), monoEnd = decimal(window.endTick), frequency = decimal(window.frequency)
  if (monoStart === null || monoEnd === null || frequency === null || frequency <= 0n || monoEnd < monoStart ||
    (monoEnd - monoStart) * 1000n > frequency * 2000n) return blocked('MONOTONIC_QUERY_WINDOW')
  // UTC and monotonic duration must agree within 250ms; a wall-clock jump is not a mapping proof.
  const drift = (end - start) * frequency - (monoEnd - monoStart) * 10000000n
  if ((drift < 0n ? -drift : drift) > frequency * 2500000n) return blocked('UTC_MONOTONIC_DISCONTINUITY')
  if (!Array.isArray(window.instances) || window.instances.length === 0 || window.completeCollection !== true)
    return blocked('INCOMPLETE_COLLECTION')
  const next = new Map(previous), names = new Set(), adapters = new Set()
  for (const instance of window.instances) {
    const match = new RegExp(`^pid_${expected.pid}_luid_(0x[0-9a-fA-F]+)_(0x[0-9a-fA-F]+)_phys_([0-9]+)$`).exec(instance.name ?? '')
    if (!match) return blocked('INSTANCE_IDENTITY')
    const adapter = `${BigInt(match[1])}:${BigInt(match[2])}:${BigInt(match[3])}`
    if (names.has(instance.name) || adapters.has(adapter)) return blocked('DUPLICATE_INSTANCE')
    names.add(instance.name); adapters.add(adapter)
    for (const source of ['wmi', 'pdh']) {
      const sample = instance[source], timestamp = utcTicks(sample?.timestampUtc), raw = decimal(sample?.rawTimestamp)
      if (!sample || sample.apiStatus !== 0 || sample.counterType !== 65792 || raw === null || raw > 2650467743999999999n ||
        sample.frequency !== '10000000' || sample.decodeStatus !== 'UNAMBIGUOUS_LOCAL_TO_UTC' ||
        (source === 'pdh' && sample.cStatus !== 0 && sample.cStatus !== 1)) return blocked('SOURCE_STATUS_OR_DECODE')
      if (timestamp === null || timestamp < start - 20000000n || timestamp > end + 2500000n)
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
