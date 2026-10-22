import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
test('G03 exporter exists before runtime integration', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/godot-presentation.mjs')))
})
test('G03 runtime carries the exact original authorized model', () => {
  assert.deepEqual(fs.readFileSync(path.join(root, 'godot/ChangshanLongdan/assets/zhaoyun.glb')),
    fs.readFileSync(path.join(root, 'public/models/zhaoyun.glb')))
})
test('G03 source-backed animation and sound manifest', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'godot/ChangshanLongdan/data/presentation.json')))
  assert.equal(data.schemaVersion, 1)
  assert.equal(data.sampleRate, 120)
  assert.equal(data.rootMotion, false)
  assert.equal(data.bones.length, 21)
  assert.equal(Object.values(data.tracks).filter(x => x.kind === 'move' && !x.air).length, 17)
  assert.ok(Object.keys(data.sources).includes('src/view/player-model.ts'))
  for (const track of Object.values(data.tracks)) {
    assert.ok(track.frames.length > 1)
    assert.ok(track.frames.every(f => f.length === 22 && f.every(t => t.length === 12 && t.every(Number.isFinite))))
  }
  for (const name of ['swing','hit','heavy','parry','hurt','jump','land','dodge','kill','musou','ready','victory','defeat','title','battle']) {
    const bytes = fs.readFileSync(path.join(root, `godot/ChangshanLongdan/assets/audio/${name}.wav`))
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
    assert.equal(bytes.readUInt16LE(22), 1)
    assert.equal(bytes.readUInt32LE(24), 22050)
    assert.equal(bytes.readUInt16LE(34), 16)
    assert.equal(bytes.readUInt32LE(40), bytes.length - 44)
    let peak = 0
    for (let i = 44; i < bytes.length; i += 2) peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)))
    assert.ok(peak > 100 && peak < 32767, name)
  }
})
