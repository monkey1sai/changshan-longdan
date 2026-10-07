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
    const c = report.counters?.find(c => c.name === name)
    return c?.available && c.validAtEnd && c.sampleCount > 0 && c.reads >= report.frames ? c.unit : null
  }
  return lines.map(line => {
    const cells = line.split(',')
    if (cells.length !== keys.length) throw new Error('TRUNCATED_CSV_ROW')
    const f = Object.fromEntries(keys.map((key, i) => [key, cells[i] === '' ? null : cells[i]]))
    for (const key of keys.filter(k => !['focus', 'minimized'].includes(k))) {
      if (f[key] !== null) { f[key] = Number(f[key]); if (!Number.isFinite(f[key])) throw new Error('INVALID_CSV_NUMBER') }
    }
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
export function gpuInstances(sample, expected) {
  const processStart = Date.parse(expected.processStart), queryStart = Date.parse(sample?.utc), queryEnd = Date.parse(sample?.queryEndUtc)
  if (!sample || sample.pid !== expected.pid || !Number.isFinite(processStart) || Date.parse(sample.processStart) !== processStart ||
      !Number.isFinite(queryStart) || !Number.isFinite(queryEnd) || queryEnd < queryStart || queryEnd - queryStart > 2000 || !Array.isArray(sample.instances)) return null
  const instances = sample.instances.filter(i => i.name?.startsWith(`pid_${expected.pid}_`))
  if (!instances.length || instances.length !== sample.instances.length || instances.some(i =>
    i.counterType !== 65792 || !Number.isFinite(Date.parse(i.timestampUtc)) || Date.parse(i.timestampUtc) < queryStart - 2000 ||
    Date.parse(i.timestampUtc) > queryEnd + 250 || ![i.dedicatedBytes, i.sharedBytes, i.committedBytes].every(v => Number.isSafeInteger(v) && v >= 0))) return null
  // Aggregate all raw adapter instances for this exact process; dedicated remains separate from shared/committed.
  return instances.reduce((a, i) => ({ dedicatedBytes: a.dedicatedBytes + i.dedicatedBytes,
    sharedBytes: a.sharedBytes + i.sharedBytes, committedBytes: a.committedBytes + i.committedBytes }),
  { dedicatedBytes: 0, sharedBytes: 0, committedBytes: 0 })
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
  return samples.map(sample => {
    let usage = gpuInstances(sample, expected)
    if (usage !== null) {
      for (const instance of sample.instances) {
        const at = Date.parse(instance.timestampUtc)
        if (accepted.has(instance.name) && at <= accepted.get(instance.name)) usage = null
      }
      // Only an entirely valid sample advances the accepted high-water marks.
      if (usage !== null) for (const instance of sample.instances) accepted.set(instance.name, Date.parse(instance.timestampUtc))
    }
    return { ...sample, usage }
  })
}
export function validateProbeIdentity(report, command) {
  if (report.pid !== command.pid || report.runId !== command.runId || report.kind !== 'CAPABILITY_PROBE') throw new Error('PROBE_IDENTITY_MISMATCH')
}
