import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import test from 'node:test'
const repo = fileURLToPath(new URL('../../', import.meta.url))
const script = path.join(repo, 'scripts/godot-reference.mjs')
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-reference-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}
const invoke = (out, mode) => spawnSync(process.execPath, ['--experimental-strip-types', script, '--out', out, mode], { cwd: repo, encoding: 'utf8', timeout: 20000 })
const read = (out, name) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'))
test('source export contains all seventeen original moves, four profiles and three hundred soldiers', t => {
  const dir = fixture(t), result = invoke(dir, '--write')
  assert.equal(result.status, 0, result.stderr)
  const r = read(dir, 'data/reference.json')
  assert.deepEqual(Object.keys(r.moves), ['N1','N2','N3','N4','N5','N6','C1','C2','C3','C4','C5','C6','JA','JC','DASH','COUNTER','MUSOU'])
  assert.equal(r.moves.N1.hits[0].damage, 14)
  assert.equal(r.moves.MUSOU.duration, 3.6)
  assert.equal(r.moves.MUSOU.hits.length, 20)
  assert.deepEqual(Object.keys(r.difficulties), ['beginner','normal','hard','chaos'])
  assert.equal(r.spawns.length, 300); assert.equal(r.capacity, 320)
  assert.deepEqual(r.playerStart, { x: 0, z: 42, facing: Math.PI })
  assert.equal(r.layout.limit, 55)
  assert.deepEqual(r.phases.map(p => p.minKo), [0,60,150,240])
  for (const f of r.sourceFiles) assert.match(f.sha256, /^[a-f0-9]{64}$/)
})
test('check is read-only and rejects missing or mutated generated data without modifying original source', t => {
  const dir = fixture(t)
  const source = path.join(repo, 'src/combat/moves.ts'), before = fs.readFileSync(source)
  assert.equal(invoke(dir, '--check').status, 1)
  assert.equal(fs.existsSync(path.join(dir, 'data')), false)
  assert.equal(invoke(dir, '--write').status, 0)
  const file = path.join(dir, 'data/reference.json'), original = fs.readFileSync(file)
  assert.equal(invoke(dir, '--check').status, 0)
  assert.deepEqual(fs.readFileSync(file), original)
  const value = JSON.parse(original); value.moves.N1.hits[0].damage = 999
  fs.writeFileSync(file, JSON.stringify(value))
  assert.equal(invoke(dir, '--check').status, 1)
  assert.deepEqual(fs.readFileSync(source), before)
  assert.equal(createHash('sha256').update(before).digest('hex'), read(dir, 'tests/reference_cases.json').sourceFiles.find(f => f.path === 'src/combat/moves.ts').sha256)
})
test('old-TS oracle pins non-ID spatial ordering and single-last-stamp interleaving semantics', t => {
  const dir = fixture(t); assert.equal(invoke(dir, '--write').status, 0)
  const c = read(dir, 'tests/reference_cases.json').contracts
  assert.deepEqual(c.spatialOrder.query, [1,0]); assert.equal(c.spatialOrder.nearest, 1)
  assert.deepEqual(c.stampSequence.hitCounts, [1,0,1,1])
  assert.deepEqual(c.stampSequence.hp, [229,229,228,227])
  assert.deepEqual(c.playerDragon.hitCounts, [1,1,1])
  assert.deepEqual(c.playerDragon.hp, [219,203,192])
  assert.notDeepEqual(c.lifecycle[0].hp, c.lifecycle[1].hp)
  assert.notDeepEqual(c.lifecycle[1].hp, c.lifecycle[2].hp)
})
test('source traces include real player routes, battle samples and dragon trajectory rather than Godot outputs', t => {
  const dir = fixture(t); assert.equal(invoke(dir, '--write').status, 0)
  const r = read(dir, 'tests/reference_cases.json')
  assert.equal(r.stepNumerator / r.stepDenominator, 1 / 60)
  const chain = r.player.find(c => c.id === 'normal_chain')
  assert.deepEqual(chain.moves.slice(0,6), ['N1','N2','N3','N4','N5','N6'])
  assert.deepEqual(r.player.find(c => c.id === 'charge_branch').moves, ['N1','N2','N3','C4'])
  assert.ok(r.player.some(c => c.id === 'parry_counter'))
  assert.deepEqual([...new Set(r.player.flatMap(c => c.moves))].sort(), ['N1','N2','N3','N4','N5','N6','C1','C2','C3','C4','C5','C6','JA','JC','DASH','COUNTER','MUSOU'].sort())
  assert.ok(r.battle.length >= 4); assert.ok(r.dragon.length > 10)
  assert.equal(r.rank.length, 7)
  assert.equal(r.math.rng.length, 12)
})
