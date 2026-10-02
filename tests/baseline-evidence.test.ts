import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  beginCase, copyRetainedPixels, createEvidenceRun, evidenceComplete, finalizeRecordings,
  preserveReadback, recordedError, recordingFailure, saveImage, snapshotAllowed, topDownRgba,
  type CaseDefinition, type EvidenceRun,
} from '../scripts/lib/baseline-evidence.ts'

const png = 'data:image/png;base64,iVBORw0KGgo='
const digest = async (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const definitions: CaseDefinition[] = Array.from({ length: 7 }, (_, index) => ({ name: `case ${index + 1}`,
  expectedIds: index === 6 ? null : [0], expectedError: index === 6 ? 'EXPECTED_DIAGNOSTIC_FAILURE' : null }))
function passingRun() {
  const run = createEvidenceRun('test-run', { sourceHead: 'saved-candidate' }, definitions)
  for (let i = 0; i < 6; i++) {
    const record = beginCase(run, i)
    preserveReadback(record, { pixels: new Uint8Array([1, 0, 0, 255]), visibleIds: [0], width: 1, height: 1,
      pixelCounts: [1], camera: { projection: [1], world: [2] } })
    saveImage(record, 'idRgbPng', png)
    saveImage(record, 'previewPng', png)
    record.functionalResult = 'PASS'
  }
  const record = beginCase(run, 6)
  record.caughtError = recordedError(new Error('EXPECTED_DIAGNOSTIC_FAILURE'), 'expected:caught')
  record.restoration = { rejected: true, wallColorWrite: true, rendererBefore: '{"target":null}', rendererAfter: '{"target":null}' }
  record.referenceImage = { caseNumber: 6, relationship: 'last successful ID readback before throw; not same-frame evidence' }
  saveImage(record, 'exceptionReportPng', png)
  record.functionalResult = 'PASS'
  run.result = 'PASS'
  run.functionalResult = 'PASS'
  run.gameplayUnchanged = true
  run.rendererRestored = true
  return run
}

describe('retained visibility evidence without renderer execution', () => {
  it('copies shared pixels, nested metadata, IDs and provenance before reuse', () => {
    const source = { sourceHead: 'saved', runnerHashes: { helper: 'original' } }
    const run = createEvidenceRun('run', source, definitions)
    const record = beginCase(run, 0)
    const result = { pixels: new Uint8Array([1, 0, 0, 255]), visibleIds: [0], width: 1, height: 1,
      camera: { world: [2] }, pixelCounts: [1] }
    preserveReadback(record, result)
    result.pixels.fill(0)
    result.visibleIds[0] = 9
    result.camera.world[0] = 99
    result.pixelCounts[0] = 99
    source.runnerHashes.helper = 'changed'
    expect(copyRetainedPixels(record)).toEqual(new Uint8Array([1, 0, 0, 255]))
    expect(record.actualIds).toEqual([0])
    expect(record.measurement).toMatchObject({ camera: { world: [2] }, pixelCounts: [1] })
    expect(run.provenance).toEqual({ sourceHead: 'saved', runnerHashes: { helper: 'original' } })
    copyRetainedPixels(record)!.fill(0)
    expect(copyRetainedPixels(record)).toEqual(new Uint8Array([1, 0, 0, 255]))
  })

  it('retains a mismatching case before the original assertion aborts later cases', async () => {
    const run = createEvidenceRun('failed-run', {}, definitions)
    const record = beginCase(run, 0)
    preserveReadback(record, { pixels: new Uint8Array([2, 0, 0, 255]), visibleIds: [1], width: 1, height: 1 })
    record.functionalResult = 'FAIL'
    record.functionalError = recordedError(new Error('unexpected IDs 1'), 'functional:assertion')
    run.functionalResult = 'FAIL'
    saveImage(record, 'idRgbPng', png)
    saveImage(record, 'previewPng', png)
    await finalizeRecordings(run, digest)
    expect(record.expected.ids).toEqual([0])
    expect(record.actualIds).toEqual([1])
    expect(record.functionalResult).toBe('FAIL')
    expect(record.recordingResult).toBe('COMPLETE')
    expect(Buffer.from(record.rawPixelsBase64!, 'base64')).toEqual(Buffer.from([2, 0, 0, 255]))
    expect(run.cases.slice(1).every(item => item.functionalResult === 'NOT_RUN')).toBe(true)
    expect(evidenceComplete(run)).toBe(false)
  })

  it('preserves an unexpected capture error without fabricating IDs or pixels', async () => {
    const run = createEvidenceRun('capture-failure', {}, definitions)
    const record = beginCase(run, 0)
    const error = new Error('actual renderer failure')
    record.functionalResult = 'FAIL'
    record.functionalError = recordedError(error, 'functional:capture')
    run.functionalResult = 'FAIL'
    await finalizeRecordings(run, digest)
    expect(record.functionalError).toMatchObject({ message: error.message, stack: error.stack })
    expect(record.actualIds).toBeNull()
    expect(record.rawPixelsBase64).toBeNull()
    expect(record.gpuReadback).toBe(false)
    expect(record.recordingResult).toBe('FAIL')
    expect(record.images).toEqual({})
  })

  it('keeps raw bytes when metadata retention fails and leaves functional judgment separate', async () => {
    const run = passingRun()
    const record = run.cases[0]
    try {
      preserveReadback(record, { pixels: new Uint8Array([1, 0, 0, 255]), visibleIds: [0], width: 1, height: 1,
        unsupported: () => 1 })
    } catch (error) { recordingFailure(record, error, 'copy-readback') }
    await finalizeRecordings(run, digest)
    expect(record.rawPixelsBase64).toBe('AQAA/w==')
    expect(record.functionalResult).toBe('PASS')
    expect(record.recordingResult).toBe('FAIL')
    expect(evidenceComplete(run)).toBe(false)
  })

  it('does not turn a PNG encoding failure into a functional failure or discard raw bytes', async () => {
    const run = passingRun()
    const record = run.cases[1]
    delete record.images.previewPng
    try { saveImage(record, 'previewPng', 'data:,') }
    catch (error) { recordingFailure(record, error, 'previewPng-encoding') }
    await finalizeRecordings(run, digest)
    expect(run.functionalResult).toBe('PASS')
    expect(record.rawPixelsBase64).toBe('AQAA/w==')
    expect(record.images.idRgbPng).toBe(png)
    expect(record.recordingErrors[0].category).toBe('recording:previewPng-encoding')
    expect(run.recordingResult).toBe('FAIL')
    expect(snapshotAllowed(run, true, true, true, 'playing')).toBe(false)
  })

  it('retains partial images and the actual hash error while blocking COMPLETE', async () => {
    const run = passingRun()
    const error = new Error('digest unavailable')
    await finalizeRecordings(run, async () => { throw error })
    expect(run.functionalResult).toBe('PASS')
    expect(run.cases[0].images.idRgbPng).toBe(png)
    expect(run.cases[0].rawPixelsBase64).toBe('AQAA/w==')
    expect(run.cases[0].recordingErrors[0]).toMatchObject({ message: error.message, stack: error.stack })
    expect(run.recordingResult).toBe('FAIL')
  })

  it('labels the intentional throw as a report with actual caught stack and no seventh readback', async () => {
    const run = passingRun()
    await finalizeRecordings(run, digest)
    const record = run.cases[6]
    expect(record.imageKind).toBe('exceptionReport')
    expect(record.gpuReadback).toBe(false)
    expect(record.expected.ids).toBeNull()
    expect(record.actualIds).toBeNull()
    expect(record.caughtError?.stack).toContain('EXPECTED_DIAGNOSTIC_FAILURE')
    expect(record.referenceImage?.relationship).toContain('not same-frame')
    expect(record.hashes.rendererBeforeSha256).toEqual(record.hashes.rendererAfterSha256)
    expect(record.hashes.exceptionReportPngSha256).toEqual(await digest(Buffer.from('iVBORw0KGgo=', 'base64')))
    expect(run.recordingResult).toBe('COMPLETE')
  })

  it('cannot complete an exception report missing its actual caught error', async () => {
    const run = passingRun()
    run.cases[6].caughtError = null
    await finalizeRecordings(run, digest)
    expect(run.cases[6].recordingResult).toBe('FAIL')
    expect(evidenceComplete(run)).toBe(false)
  })

  it('cannot complete a report missing an original renderer restoration observation', async () => {
    const run = passingRun()
    run.cases[6].restoration = null
    await finalizeRecordings(run, digest)
    expect(run.cases[6].recordingResult).toBe('FAIL')
  })

  it('does not allow a duplicate case to replace earlier evidence', () => {
    const run = createEvidenceRun('once', {}, definitions)
    beginCase(run, 0)
    expect(() => beginCase(run, 0)).toThrow('case already started')
    expect(() => beginCase(run, 7)).toThrow('unavailable')
  })

  it('marks PROCESSING until deferred hashes settle without changing the functional result', async () => {
    const run = passingRun()
    let releaseHash!: () => void
    const paused = new Promise<void>(resolve => { releaseHash = resolve })
    const pending = finalizeRecordings(run, async value => { await paused; return digest(value) })
    expect(run.recordingResult).toBe('PROCESSING')
    expect(run.functionalResult).toBe('PASS')
    expect(snapshotAllowed(run, true, true, true, 'playing')).toBe(false)
    releaseHash()
    await pending
    expect(evidenceComplete(run)).toBe(true)
  })

  it.each([
    [false, true, true, 'playing'], [true, false, true, 'playing'], [true, true, false, 'playing'],
    [true, true, true, 'title'], [true, true, true, 'victory'],
  ] as const)('blocks snapshot when source=%s ready=%s visible=%s mode=%s', async (source, ready, visible, mode) => {
    const run = passingRun()
    await finalizeRecordings(run, digest)
    expect(snapshotAllowed(run, source, ready, visible, mode)).toBe(false)
  })

  it('allows only seven complete passing cases with both original state checks', async () => {
    const run = passingRun()
    await finalizeRecordings(run, digest)
    expect(snapshotAllowed(run, true, true, true, 'paused')).toBe(true)
    for (const field of ['gameplayUnchanged', 'rendererRestored'] as const) {
      run[field] = false
      expect(snapshotAllowed(run, true, true, true, 'playing')).toBe(false)
      run[field] = true
    }
    run.cases[0].functionalResult = 'FAIL'
    expect(evidenceComplete(run)).toBe(false)
    run.cases[0].functionalResult = 'PASS'
    run.cases.pop()
    expect(evidenceComplete(run)).toBe(false)
    expect(snapshotAllowed(null, true, true, true, 'playing')).toBe(false)
  })

  it('exports failed and unrun rows with raw bytes and errors intact', async () => {
    const run = passingRun()
    run.functionalResult = 'FAIL'
    run.cases[0].functionalResult = 'FAIL'
    run.cases[0].functionalError = recordedError('mismatch', 'functional:assertion')
    run.cases[5].functionalResult = 'NOT_RUN'
    run.cases[5].recordingResult = 'NOT_RUN'
    await finalizeRecordings(run, digest)
    const exported = JSON.parse(JSON.stringify(run)) as EvidenceRun
    expect(exported.cases[0].functionalError?.text).toBe('mismatch')
    expect(exported.cases[0].rawPixelsBase64).toBe('AQAA/w==')
    expect(exported.cases[5].functionalResult).toBe('NOT_RUN')
    expect(exported.cases).toHaveLength(7)
  })
})

describe('retained pixel conversion', () => {
  it('flips rows once, preserving 24-bit IDs including values above 255 and original alpha', () => {
    const bottomUp = new Uint8Array([0, 0, 0, 0, 0, 1, 0, 127, 255, 255, 0, 255, 1, 0, 1, 42])
    expect(Array.from(topDownRgba(bottomUp, 2, 2, false))).toEqual([
      255, 255, 0, 255, 1, 0, 1, 42, 0, 0, 0, 0, 0, 1, 0, 127,
    ])
    expect(bottomUp[7]).toBe(127)
  })

  it('changes only the preview palette while retaining zero-ID background and opaque preview alpha', () => {
    expect(Array.from(topDownRgba(new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]), 2, 1, true))).toEqual([
      92, 134, 198, 255, 0, 0, 0, 255,
    ])
  })

  it.each([[0, 1, 0], [1, -1, 0], [1.5, 1, 4], [1, 1, 3]])('rejects invalid width=%s height=%s bytes=%s', (width, height, length) => {
    expect(() => topDownRgba(new Uint8Array(length), width, height, false)).toThrow('invalid RGBA dimensions')
  })
})
