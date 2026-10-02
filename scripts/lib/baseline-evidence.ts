// Data retention only: no renderer, gameplay, DOM, network or capture calls.
export type FunctionalResult = 'NOT_RUN' | 'IN_PROGRESS' | 'PASS' | 'FAIL'
export type RecordingResult = 'NOT_RUN' | 'IN_PROGRESS' | 'PROCESSING' | 'COMPLETE' | 'FAIL'
export interface RecordedError {
  category: string
  observedAt: string
  name: string | null
  message: string
  text: string
  stack: string | null
}
export interface CaseDefinition { name: string; expectedIds: number[] | null; expectedError: string | null }
export interface Readback {
  pixels: Uint8Array
  visibleIds: number[]
  width: number
  height: number
  [key: string]: unknown
}
export interface CaseEvidence {
  caseNumber: number
  name: string
  expected: { ids: number[] | null; error: string | null }
  actualIds: number[] | null
  functionalResult: FunctionalResult
  recordingResult: RecordingResult
  imageKind: 'enemyIdReadback' | 'exceptionReport'
  gpuReadback: boolean
  measurement: Record<string, unknown> | null
  rawPixelsBase64: string | null
  rawPixelEncoding: 'RGBA8 bottom-up; RGB = enemy ID + 1; alpha unchanged'
  images: Partial<Record<'idRgbPng' | 'previewPng' | 'exceptionReportPng', string>>
  hashes: Partial<Record<'rawPixelsSha256' | 'idRgbPngSha256' | 'previewPngSha256' | 'exceptionReportPngSha256' | 'rendererBeforeSha256' | 'rendererAfterSha256', string>>
  caughtError: RecordedError | null
  functionalError: RecordedError | null
  recordingErrors: RecordedError[]
  restoration: { rejected: boolean; wallColorWrite: boolean; rendererBefore: string; rendererAfter: string } | null
  referenceImage: { caseNumber: number; relationship: 'last successful ID readback before throw; not same-frame evidence' } | null
}
export interface EvidenceRun {
  schema: 'e01-visibility-case-evidence/v1'
  runId: string
  startedAt: string
  provenance: unknown
  result: FunctionalResult
  functionalResult: FunctionalResult
  recordingResult: RecordingResult
  tests: { name: string; result: 'PASS'; ids?: number[] }[]
  cases: CaseEvidence[]
  gameplayUnchanged: boolean | null
  rendererRestored: boolean | null
  gpuActiveMs: null
  error: RecordedError | null
}

const retainedPixels = new WeakMap<CaseEvidence, Uint8Array>()

export function recordedError(error: unknown, category: string): RecordedError {
  return { category, observedAt: new Date().toISOString(), name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error), text: String(error),
    stack: error instanceof Error ? error.stack ?? null : null }
}

export function createEvidenceRun(runId: string, provenance: unknown, definitions: readonly CaseDefinition[]): EvidenceRun {
  return { schema: 'e01-visibility-case-evidence/v1', runId, startedAt: new Date().toISOString(),
    provenance: structuredClone(provenance), result: 'IN_PROGRESS', functionalResult: 'IN_PROGRESS',
    recordingResult: 'IN_PROGRESS', tests: [], gameplayUnchanged: null, rendererRestored: null, gpuActiveMs: null, error: null,
    cases: definitions.map((definition, index) => ({ caseNumber: index + 1, name: definition.name,
      expected: { ids: definition.expectedIds?.slice() ?? null, error: definition.expectedError }, actualIds: null,
      functionalResult: 'NOT_RUN', recordingResult: 'NOT_RUN',
      imageKind: definition.expectedError === null ? 'enemyIdReadback' : 'exceptionReport', gpuReadback: false,
      measurement: null, rawPixelsBase64: null, rawPixelEncoding: 'RGBA8 bottom-up; RGB = enemy ID + 1; alpha unchanged',
      images: {}, hashes: {}, caughtError: null, functionalError: null, recordingErrors: [], restoration: null, referenceImage: null })) }
}

export function beginCase(run: EvidenceRun, index: number) {
  const record = run.cases[index]
  if (!record || record.functionalResult !== 'NOT_RUN') throw new Error('case already started or unavailable')
  record.functionalResult = 'IN_PROGRESS'
  record.recordingResult = 'IN_PROGRESS'
  return record
}

/** Call immediately after the original capture, before its original assertion. */
export function preserveReadback(record: CaseEvidence, result: Readback) {
  record.actualIds = result.visibleIds.slice()
  const { pixels, ...measurement } = result
  // Preserve bytes even if later metadata cloning / image encoding fails.
  retainedPixels.set(record, Uint8Array.from(pixels))
  record.gpuReadback = true
  record.measurement = structuredClone(measurement)
}

export function copyRetainedPixels(record: CaseEvidence) {
  const pixels = retainedPixels.get(record)
  return pixels ? Uint8Array.from(pixels) : null
}

export function recordingFailure(record: CaseEvidence, error: unknown, stage: string) {
  record.recordingErrors.push(recordedError(error, `recording:${stage}`))
  record.recordingResult = 'FAIL'
}

/** Only converts a retained readback. Row reversal preserves raw RGB and alpha bytes. */
export function topDownRgba(pixels: Uint8Array, width: number, height: number, colored: boolean) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || pixels.length !== width * height * 4) throw new Error('invalid RGBA dimensions')
  const image = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4
      const destination = ((height - 1 - y) * width + x) * 4
      const id = pixels[source] + pixels[source + 1] * 256 + pixels[source + 2] * 65536
      for (let channel = 0; channel < 3; channel++) image[destination + channel] = colored && id
        ? (id * [67, 109, 173][channel]) % 230 + 25 : pixels[source + channel]
      image[destination + 3] = colored ? 255 : pixels[source + 3]
    }
  }
  return image
}

export function saveImage(record: CaseEvidence, kind: keyof CaseEvidence['images'], value: string) {
  if (!value.startsWith('data:image/png;base64,') || value.length === 'data:image/png;base64,'.length) {
    throw new Error('PNG encoding did not produce an image')
  }
  record.images[kind] = value
}

function base64(bytes: Uint8Array) {
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)))
  return btoa(chunks.join(''))
}

function pngBytes(dataUrl: string) {
  return Uint8Array.from(atob(dataUrl.slice('data:image/png;base64,'.length)), character => character.charCodeAt(0))
}

/** Run only after the synchronous fixture and original gameplay assertions have finished. */
export async function finalizeRecordings(run: EvidenceRun, digest: (value: string | Uint8Array) => Promise<string>) {
  run.recordingResult = 'PROCESSING'
  for (const record of run.cases) {
    if (record.functionalResult === 'NOT_RUN') continue
    if (record.recordingResult !== 'FAIL') record.recordingResult = 'PROCESSING'
    const pixels = retainedPixels.get(record)
    if (pixels) {
      // Keep exportable raw bytes independently of PNG/hash success.
      try { record.rawPixelsBase64 = base64(pixels) }
      catch (error) { recordingFailure(record, error, 'raw-byte-export') }
      try { record.hashes.rawPixelsSha256 = await digest(pixels) }
      catch (error) { recordingFailure(record, error, 'raw-byte-hash') }
    }
    for (const kind of ['idRgbPng', 'previewPng', 'exceptionReportPng'] as const) {
      const png = record.images[kind]
      if (!png) continue
      try { record.hashes[`${kind}Sha256`] = await digest(pngBytes(png)) }
      catch (error) { recordingFailure(record, error, `${kind}-hash`) }
    }
    if (record.restoration) {
      for (const name of ['rendererBefore', 'rendererAfter'] as const) {
        try { record.hashes[`${name}Sha256`] = await digest(record.restoration[name]) }
        catch (error) { recordingFailure(record, error, `${name}-hash`) }
      }
    }
    const complete = record.imageKind === 'enemyIdReadback'
      ? record.gpuReadback && record.measurement !== null && record.rawPixelsBase64 !== null
        && !!record.hashes.rawPixelsSha256 && !!record.hashes.idRgbPngSha256 && !!record.hashes.previewPngSha256
      : !record.gpuReadback && record.actualIds === null && record.caughtError !== null && record.restoration !== null
        && !!record.hashes.exceptionReportPngSha256 && !!record.hashes.rendererBeforeSha256 && !!record.hashes.rendererAfterSha256
    if (!complete) recordingFailure(record, new Error('required case artifacts incomplete'), 'completeness')
    if (record.recordingResult !== 'FAIL') record.recordingResult = 'COMPLETE'
  }
  run.recordingResult = run.cases.length > 0 && run.cases.every(record => record.recordingResult === 'COMPLETE') ? 'COMPLETE' : 'FAIL'
}

export function evidenceComplete(run: EvidenceRun | null) {
  return run?.functionalResult === 'PASS' && run.recordingResult === 'COMPLETE'
    && run.cases.length === 7 && run.cases.every(record => record.functionalResult === 'PASS' && record.recordingResult === 'COMPLETE')
    && run.gameplayUnchanged === true && run.rendererRestored === true
}

export function snapshotAllowed(run: EvidenceRun | null, sourceVerified: boolean, assetReady: boolean, visible: boolean, mode: string) {
  return sourceVerified && assetReady && visible && ['playing', 'paused'].includes(mode) && evidenceComplete(run)
}
