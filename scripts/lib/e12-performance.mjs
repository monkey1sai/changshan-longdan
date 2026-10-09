export const limits = Object.freeze({ cpuP95Ms: 16.67, gpuP95Ms: 16.67, wallP99Ms: 25, over50Fraction: 0.001 })

export function nearestRank(values, quantile) {
  if (!values.length || !(quantile > 0 && quantile <= 1) || values.some(v => !Number.isFinite(v) || v < 0))
    throw new Error('INVALID_QUANTILE_INPUT')
  return [...values].sort((a, b) => a - b)[Math.ceil(quantile * values.length) - 1]
}
export function timeMs(raw, unit) {
  if (!Number.isFinite(raw) || raw <= 0) return null
  if (unit === 'TimeNanoseconds') return raw / 1e6
  return null // Unknown units are never guessed from a counter's name.
}
export function metricSummary(frames) {
  const fields = ['wallMs', 'mainMs', 'renderMs', 'gpuMs']
  if (!frames.length || fields.some(k => frames.some(f => !Number.isFinite(f[k]) || f[k] <= 0)))
    return { status: 'BLOCKED', reason: 'MISSING_OR_INVALID_TIMING', metrics: null }
  const metrics = {
    mainP95Ms: nearestRank(frames.map(f => f.mainMs), 0.95), renderP95Ms: nearestRank(frames.map(f => f.renderMs), 0.95),
    gpuP95Ms: nearestRank(frames.map(f => f.gpuMs), 0.95), wallP99Ms: nearestRank(frames.map(f => f.wallMs), 0.99),
    over50Fraction: frames.filter(f => f.wallMs > 50).length / frames.length,
  }
  metrics.cpuActiveGateMs = Math.max(metrics.mainP95Ms, metrics.renderP95Ms)
  return { status: metrics.cpuActiveGateMs <= limits.cpuP95Ms && metrics.gpuP95Ms <= limits.gpuP95Ms &&
    metrics.wallP99Ms <= limits.wallP99Ms && metrics.over50Fraction <= limits.over50Fraction ? 'PASS_METRICS_ONLY' : 'FAIL_METRICS', metrics }
}
export function parseProbeCsv(text, report) {
  const lines = text.trim().split(/\r?\n/), keys = lines.shift().split(',')
  const unit = name => {
    const candidates = report.counters?.filter(c => c.name === name && c.category === 'Render') ?? []
    const c = candidates.length === 1 && candidates[0].unit === 'TimeNanoseconds' ? candidates[0] : null
    return c?.available && c.validAtEnd && c.sampleCount > 0 && c.reads >= report.frames ? c.unit : null
  }
  return lines.map(line => {
    const cells = line.split(',')
    if (cells.length !== keys.length) throw new Error('TRUNCATED_CSV_ROW')
    const f = Object.fromEntries(keys.map((key, i) => [key, cells[i] === '' ? null : cells[i]]))
    const byteFields = ['privateBytes', 'workingSet', 'allocated', 'gcUsed', 'gcReserved', 'used']
    for (const key of keys.filter(k => !['focus', 'minimized', ...byteFields].includes(k))) {
      if (f[key] !== null) { f[key] = Number(f[key]); if (!Number.isFinite(f[key])) throw new Error('INVALID_CSV_NUMBER') }
    }
    for (const key of byteFields) if (f[key] !== undefined && f[key] !== null && byteValue(f[key]) === null) throw new Error('INVALID_CSV_BYTES')
    for (const key of ['focus', 'minimized']) {
      if (f[key] !== 'True' && f[key] !== 'False') throw new Error('INVALID_CSV_BOOLEAN')
      f[key] = f[key] === 'True'
    }
    f.mainMs = timeMs(f.cpuMainRaw, unit('CPU Main Thread Frame Time'))
    f.renderMs = timeMs(f.cpuRenderRaw, unit('CPU Render Thread Frame Time'))
    f.gpuMs = timeMs(f.gpuRaw, unit('GPU Frame Time'))
    return f
  })
}
// Parse the whole-second calendar independently; fraction arithmetic never goes through Date/Number.
function utcTicks(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/.exec(value)
  if (!match) return null
  const milliseconds = Date.parse(match[1] + 'Z')
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== match[1]) return null
  return BigInt(milliseconds) * 10000n + BigInt((match[2] ?? '').padEnd(7, '0'))
}
function byteValue(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return null
  const result = BigInt(value)
  return result <= 9223372036854775807n ? result : null
}
export function gpuInstances(sample, expected) {
  const processStart = utcTicks(expected.processStart), queryStart = utcTicks(sample?.utc), queryEnd = utcTicks(sample?.queryEndUtc)
  if (!sample || !Number.isSafeInteger(expected.pid) || expected.pid <= 0 || sample.pid !== expected.pid || processStart === null || utcTicks(sample.processStart) !== processStart ||
      queryStart === null || queryEnd === null || queryEnd < queryStart || queryEnd - queryStart > 20000000n || !Array.isArray(sample.instances)) return null
  if (sample.error) return null
  if (sample.schemaVersion === 2 && (sample.pidAfter !== expected.pid || utcTicks(sample.processStartAfter) !== processStart ||
    !sample.timezoneId || sample.clockMapping !== 'LOCAL_ENCODED_VALIDATED_SOURCE')) return null
  const instances = sample.instances.filter(i => i.name?.startsWith(`pid_${expected.pid}_`))
  if (new Set(instances.map(i => i.name)).size !== instances.length) return null
  if (!instances.length || instances.length !== sample.instances.length || instances.some(i =>
    i.counterType !== 65792 || utcTicks(i.timestampUtc) === null || utcTicks(i.timestampUtc) < queryStart - 20000000n ||
    utcTicks(i.timestampUtc) > queryEnd + 2500000n || ![i.dedicatedBytes, i.sharedBytes, i.committedBytes].every(v => byteValue(v) !== null))) return null
  if (sample.schemaVersion === 2 && instances.some(i =>
    !new RegExp(`^pid_${expected.pid}_luid_0x[0-9A-Fa-f]+_0x[0-9A-Fa-f]+_phys_[0-9]+$`).test(i.name) ||
    typeof i.timestampSys100Ns !== 'string' || byteValue(i.timestampSys100Ns) === null || i.frequencySys100Ns !== '10000000')) return null
  if (sample.schemaVersion === 2) {
    const canonical = instances.map(i => {
      const parts = /_luid_(0x[0-9A-Fa-f]+)_(0x[0-9A-Fa-f]+)_phys_([0-9]+)$/.exec(i.name)
      return `${BigInt(parts[1])}:${BigInt(parts[2])}:${BigInt(parts[3])}`
    })
    if (new Set(canonical).size !== canonical.length) return null
  }
  // Aggregate all raw adapter instances for this exact process; dedicated remains separate from shared/committed.
  const fields = ['dedicatedBytes', 'sharedBytes', 'committedBytes']
  const precise = instances.every(i => fields.every(field => typeof i[field] === 'string'))
  if (!precise && !instances.every(i => fields.every(field => typeof i[field] === 'number'))) return null
  const usage = Object.fromEntries(fields.map(field => [field, instances.reduce((sum, i) => sum + byteValue(i[field]), 0n)]))
  const maximum = precise ? 9223372036854775807n : BigInt(Number.MAX_SAFE_INTEGER)
  if (Object.values(usage).some(value => value > maximum)) return null
  return Object.fromEntries(fields.map(field => [field, precise ? usage[field].toString() : Number(usage[field])]))
}
export function probeVerdict(report, frames, gpuSamples = []) {
  const gaps = [...(report.gaps ?? [])]
  if (report.error) gaps.push(report.error)
  if (report.kind !== 'CAPABILITY_PROBE') gaps.push('UNEXPECTED_KIND')
  if (report.frames !== frames.length || !frames.length) gaps.push('MISSING_FRAMES')
  if (report.width !== 1920 || report.height !== 1080 || report.renderScale !== 1 || report.refresh !== 60 ||
      report.vSync !== 1 || report.cap !== 60 || report.batchMode) gaps.push('HARDWARE_OR_RENDER_CONTEXT')
  if (frames.some((f, i) => i > 0 && (f.frame !== frames[i - 1].frame + 1 || f.seconds <= frames[i - 1].seconds))) gaps.push('NONCONTIGUOUS_FRAME_SEQUENCE')
  if (frames.some(f => !f.focus || f.foregroundPid !== report.pid || f.minimized)) gaps.push('FOREGROUND_NOT_PROVEN')
  if (frames.some(f => f.visible === null) || report.visibleProvider === 'UNAVAILABLE') gaps.push('VISIBLE_PROVIDER_UNAVAILABLE')
  if (!gpuSamples.length) gaps.push('VRAM_PROVIDER_UNAVAILABLE')
  const timing = metricSummary(frames)
  if (timing.status === 'BLOCKED') gaps.push(timing.reason)
  return { status: 'BLOCKED_CAPABILITY_PROBE', benchmarkAllowed: false, formalBenchmark: 'NOT_RUN',
    timingDiagnostic: timing, gaps: [...new Set(gaps)], frames: frames.length }
}
export function validateGpuSeries(samples, expected) {
  const accepted = new Map()
  let adapterSet = null
  return samples.map(sample => {
    let usage = gpuInstances(sample, expected)
    if (usage !== null) {
      const keys = sample.instances.map(i => i.name).sort().join('|')
      if (adapterSet !== null && keys !== adapterSet) usage = null
      for (const instance of sample.instances) {
        const at = utcTicks(instance.timestampUtc)
        if (accepted.has(instance.name) && at <= accepted.get(instance.name)) usage = null
      }
      // Only an entirely valid sample advances the accepted high-water marks.
      if (usage !== null) {
        adapterSet = keys
        for (const instance of sample.instances) accepted.set(instance.name, utcTicks(instance.timestampUtc))
      }
    }
    return { ...sample, usage }
  })
}
export function validateProbeIdentity(report, command) {
  if (report.pid !== command.pid || report.runId !== command.runId || report.kind !== 'CAPABILITY_PROBE') throw new Error('PROBE_IDENTITY_MISMATCH')
}

// Metadata is an observed registration/environment inventory, never a validated clock mapping.
export function clockMetadataVerdict(raw, expected) {
  const invalid = reason => ({ status: 'BLOCKED_INVALID_CLOCK_METADATA', metadataObserved: false,
    clockMapping: 'UNVERIFIED', playerAllowed: false, counterWindows: 0, reasons: [reason] })
  if (raw?.schemaVersion !== 1 || raw.kind !== 'PLAYER_CLOCK_METADATA_ONLY' ||
    raw.runId !== expected.runId || raw.sourceHead !== expected.sourceHead || raw.scriptSha256 !== expected.scriptSha256 ||
    raw.maximumCimQueries !== 4 || raw.counterWindows !== 0 || raw.clockMapping !== 'UNVERIFIED' ||
    raw.gpuCounterProducerBinding !== null || !['BLOCKED_METADATA', 'METADATA_OBSERVED_CLOCK_MAPPING_BLOCKED'].includes(raw.status))
    return invalid('METADATA_IDENTITY_OR_UNSUPPORTED_CLAIM')
  const names = ['OS', 'GPU_DRIVERS', 'GPU_COUNTER_CLASS', 'WMI_BRIDGE_REGISTRATION', 'WMI_BRIDGE_INPROC_REGISTRY64', 'FIXED_SYSTEM_FILES']
  if (!Array.isArray(raw.queries) || raw.queries.length > names.length) return invalid('METADATA_QUERY_BUDGET')
  let previousEnd = null
  for (const [i, query] of raw.queries.entries()) {
    if (query.name !== names[i] || !Number.isFinite(query.elapsedMs) || query.elapsedMs < 0 ||
      byteValue(query.startTick) === null || byteValue(query.endTick) === null || byteValue(query.frequency) === null ||
      BigInt(query.frequency) <= 0n || BigInt(query.endTick) < BigInt(query.startTick) ||
      (previousEnd !== null && BigInt(query.startTick) < previousEnd)) return invalid('METADATA_QUERY_ORDER_OR_CLOCK')
    previousEnd = BigInt(query.endTick)
    if ((query.error || query.elapsedMs > 2000 || BigInt(query.endTick) - BigInt(query.startTick) > 2n * BigInt(query.frequency)) &&
      (i !== raw.queries.length - 1 || raw.status !== 'BLOCKED_METADATA'))
      return invalid('METADATA_CONTINUED_AFTER_FAILURE')
  }
  const observed = raw.status === 'METADATA_OBSERVED_CLOCK_MAPPING_BLOCKED'
  const file = value => value && typeof value.path === 'string' && value.path.length > 0 &&
    typeof value.fileVersion === 'string' && value.fileVersion.length > 0 && /^[a-f0-9]{64}$/.test(value.sha256)
  if (observed && (raw.queries.length !== names.length || raw.wmiBridgeIdentity?.name !== 'WmiPerfInst' ||
    raw.wmiBridgeIdentity.loadedModuleProven !== false || !file(raw.wmiBridgeIdentity.registeredDll) ||
    !raw.counterSchemaIdentity || !raw.environmentVersions?.os?.Version || !raw.environmentVersions.os.BuildNumber ||
    !raw.environmentVersions.timezoneId || !file(raw.environmentVersions.pdh) || !file(raw.environmentVersions.graphicsKernel) ||
    !Array.isArray(raw.environmentVersions.gpuDrivers) || raw.environmentVersions.gpuDrivers.length === 0 ||
    raw.environmentVersions.gpuDrivers.some(d => !d.Name || !d.DriverVersion || !d.PNPDeviceID))) return invalid('METADATA_REQUIRED_FIELD_MISSING')
  return { status: 'BLOCKED_CLOCK_MAPPING', metadataObserved: observed, clockMapping: 'UNVERIFIED',
    playerAllowed: false, counterWindows: 0, reasons: [raw.error ?? 'GPU_COUNTER_PRODUCER_BINDING_UNPROVEN'] }
}
