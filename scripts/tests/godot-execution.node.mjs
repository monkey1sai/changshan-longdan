import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { claimOutput, inspectGodot, packagePayload, payloadManifest, readGodotReport, runProcess, verifyPayload } from '../lib/godot-execution.mjs'

// Each case catches an unsafe acceptance or missing lifecycle effect, not source-text changes.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-g01-'))
  const repo = path.join(root, 'repo')
  fs.mkdirSync(repo)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { root, repo }
}

function inventoryFixture(t) {
  const { root, repo } = fixture(t)
  const project = path.join(repo, 'godot', 'ChangshanLongdan'); fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(path.join(project, 'project.godot'), '[application]\nrun/main_scene="res://scenes/bootstrap.tscn"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n')
  fs.writeFileSync(path.join(project, 'export_presets.cfg'), '[preset.0]\nname="Windows Desktop"\nplatform="Windows Desktop"\n[preset.0.options]\nbinary_format/architecture="x86_64"\n[preset.1]\nname="Web"\nplatform="Web"\n[preset.1.options]\nvariant/thread_support=false\n')
  const templates = path.join(root, 'templates'); fs.mkdirSync(templates)
  const names = ['version.txt', 'icudt_godot.dat', 'windows_debug_x86_64.exe', 'windows_debug_x86_64_console.exe', 'windows_release_x86_64.exe', 'windows_release_x86_64_console.exe', 'web_nothreads_debug.zip', 'web_nothreads_release.zip']
  const lock = { schemaVersion: 1, version: '4.7.2.stable.official.ed1daf0bf', templateVersion: '4.7.2.stable', executableSha256: createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'), templates: {} }
  for (const name of names) {
    const value = name === 'version.txt' ? '4.7.2.stable\n' : `fixture-${name}`
    fs.writeFileSync(path.join(templates, name), value)
    lock.templates[name] = createHash('sha256').update(value).digest('hex')
  }
  const lockPath = path.join(root, 'lock.json'); fs.writeFileSync(lockPath, JSON.stringify(lock))
  return { root, repo, project, templates, lockPath, lock, executable: process.execPath }
}

const report = () => ({ schemaVersion: 1, runId: 'fresh-run', candidate: 'a'.repeat(40),
  startedAtMs: 1100, finishedAtMs: 1200, total: 3, passed: 3, failed: 0, skipped: 0,
  cases: [{ name: 'scene', pass: true }, { name: 'counter', pass: true }, { name: 'renderer', pass: true }] })
const context = { runId: 'fresh-run', candidate: 'a'.repeat(40), startedAtMs: 1000, finishedAtMs: 1300 }

test('claimOutput creates only a new external evidence directory', t => {
  const { root, repo } = fixture(t)
  const output = path.join(root, 'new-evidence')
  assert.equal(claimOutput(output, repo), output)
  assert.ok(fs.statSync(output).isDirectory())
  assert.throws(() => claimOutput(output, repo), /OUTPUT_EXISTS/)
})

test('claimOutput rejects checkout paths, ancestors and junction escapes without writing', t => {
  const { root, repo } = fixture(t)
  assert.throws(() => claimOutput(path.join(repo, 'evidence'), repo), /OUTPUT_INSIDE_CHECKOUT/)
  assert.throws(() => claimOutput(repo, repo), /OUTPUT_INSIDE_CHECKOUT/)
  assert.throws(() => claimOutput(root, repo), /OUTPUT_CONTAINS_CHECKOUT|OUTPUT_EXISTS/)
  const actual = path.join(root, 'actual'); fs.mkdirSync(actual)
  const link = path.join(root, 'link')
  fs.symlinkSync(actual, link, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => claimOutput(path.join(link, 'new'), repo), /UNSAFE_PATH/)
  assert.equal(fs.existsSync(path.join(actual, 'new')), false)
})

test('runProcess preserves stdout/stderr and nonzero exit instead of reporting success', async () => {
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write("out");process.stderr.write("err");process.exitCode=7'], { timeoutMs: 3000 })
  assert.equal(result.exitCode, 7)
  assert.equal(result.stdout, 'out')
  assert.equal(result.stderr, 'err')
  assert.equal(result.timedOut, false)
})

test('runProcess bounds a hung owned child and records timeout', async () => {
  const result = await runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 })
  assert.equal(result.timedOut, true)
  assert.ok(result.durationMs < 3000)
})

test('runProcess reports a missing executable as failure, not an empty successful run', async () => {
  const result = await runProcess(path.join(os.tmpdir(), 'no-such-godot-executable-82e98e4'), [], { timeoutMs: 500 })
  assert.notEqual(result.exitCode, 0)
  assert.match(result.error, /ENOENT|not found/i)
})

test('runProcess enforces captured-output limits on an owned noisy process', async () => {
  const result = await runProcess(process.execPath, ['-e', 'setInterval(()=>process.stdout.write("x".repeat(4096)),1)'], { timeoutMs: 3000, maxOutputBytes: 128 })
  assert.equal(result.outputLimited, true)
  assert.ok(Buffer.byteLength(result.stdout) <= 128)
})

test('readGodotReport accepts fresh, nonzero, internally consistent actual cases', t => {
  const { root } = fixture(t)
  const file = path.join(root, 'report.json'); fs.writeFileSync(file, JSON.stringify(report()))
  assert.equal(readGodotReport(file, context).passed, 3)
})

test('readGodotReport rejects zero, failed, skipped, stale and wrong-identity reports', t => {
  const { root } = fixture(t)
  const file = path.join(root, 'report.json')
  for (const mutate of [r => { r.total = 0; r.passed = 0; r.cases = [] },
    r => { r.failed = 1 }, r => { r.skipped = 1 }, r => { r.runId = 'old-run' },
    r => { r.candidate = 'b'.repeat(40) }, r => { r.startedAtMs = 999 },
    r => { r.finishedAtMs = 1400 }, r => { r.cases[1].pass = false },
    r => { r.cases.pop() }, r => { r.cases[1].name = 'scene' },
    r => { r.passed = null }, r => { r.startedAtMs = Infinity }]) {
    const value = report(); mutate(value); fs.writeFileSync(file, JSON.stringify(value))
    assert.throws(() => readGodotReport(file, context), /INVALID_TEST_REPORT/)
  }
  fs.writeFileSync(file, '{bad json')
  assert.throws(() => readGodotReport(file, context), /INVALID_TEST_REPORT/)
  assert.throws(() => readGodotReport(path.join(root, 'missing.json'), context), /TEST_REPORT_MISSING/)
})

test('payload verification detects mutation, deletion and extra files in the whole package', t => {
  const { root } = fixture(t)
  const build = path.join(root, 'build'); fs.mkdirSync(build)
  fs.writeFileSync(path.join(build, 'game.exe'), 'exe')
  fs.writeFileSync(path.join(build, 'game.pck'), 'payload')
  const manifest = payloadManifest(build)
  assert.deepEqual(manifest.files.map(f => f.path), ['game.exe', 'game.pck'])
  verifyPayload(build, manifest)
  fs.writeFileSync(path.join(build, 'game.pck'), 'changed')
  assert.throws(() => verifyPayload(build, manifest), /PAYLOAD_MISMATCH/)
  fs.writeFileSync(path.join(build, 'game.pck'), 'payload')
  fs.writeFileSync(path.join(build, 'extra.txt'), 'extra')
  assert.throws(() => verifyPayload(build, manifest), /PAYLOAD_MISMATCH/)
  fs.unlinkSync(path.join(build, 'extra.txt')); fs.unlinkSync(path.join(build, 'game.pck'))
  assert.throws(() => verifyPayload(build, manifest), /PAYLOAD_MISMATCH/)
})

test('payload verification includes dot-directories rather than hiding extra package content', t => {
  const { root } = fixture(t)
  const build = path.join(root, 'build'); fs.mkdirSync(build)
  fs.writeFileSync(path.join(build, 'game.exe'), 'exe')
  const manifest = payloadManifest(build)
  fs.mkdirSync(path.join(build, '.godot'))
  fs.writeFileSync(path.join(build, '.godot', 'unexpected.bin'), 'untracked payload')
  assert.throws(() => verifyPayload(build, manifest), /PAYLOAD_MISMATCH/)
})

test('packagePayload writes the actual complete payload as a relative root ZIP and refuses overwrite', t => {
  const { root } = fixture(t)
  const build = path.join(root, 'build'); fs.mkdirSync(build)
  fs.writeFileSync(path.join(build, 'index.html'), '<html>G01</html>')
  fs.writeFileSync(path.join(build, 'index.wasm'), Buffer.from([0, 97, 115, 109]))
  const filename = path.join(root, 'web.zip')
  const result = packagePayload(build, filename)
  const bytes = fs.readFileSync(filename)
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'))
  assert.equal(result.bytes, bytes.length)
  const entries = {}; let offset = 0
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8), size = bytes.readUInt32LE(offset + 18)
    const nameSize = bytes.readUInt16LE(offset + 26), extraSize = bytes.readUInt16LE(offset + 28)
    const name = bytes.subarray(offset + 30, offset + 30 + nameSize).toString()
    const begin = offset + 30 + nameSize + extraSize, data = bytes.subarray(begin, begin + size)
    entries[name] = method === 8 ? inflateRawSync(data) : data
    offset = begin + size
  }
  assert.deepEqual(Object.keys(entries), ['index.html', 'index.wasm'])
  assert.equal(entries['index.html'].toString(), '<html>G01</html>')
  assert.deepEqual(entries['index.wasm'], Buffer.from([0, 97, 115, 109]))
  assert.throws(() => packagePayload(build, filename), /OUTPUT_EXISTS/)
})

test('payloadManifest rejects symlinked package members and empty payloads', t => {
  const { root } = fixture(t)
  const build = path.join(root, 'build'); fs.mkdirSync(build)
  assert.throws(() => payloadManifest(build), /EMPTY_PAYLOAD/)
  const external = path.join(root, 'external'); fs.mkdirSync(external)
  fs.writeFileSync(path.join(external, 'outside.txt'), 'outside')
  fs.symlinkSync(external, path.join(build, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => payloadManifest(build), /UNSAFE_PATH/)
})

test('inventory blocks a real executable reporting the wrong locked version', async t => {
  const options = inventoryFixture(t)
  const result = await inspectGodot(options)
  assert.equal(result.ready, false)
  assert.equal(result.version, process.version)
  assert.ok(result.blockers.includes('VERSION_MISMATCH'))
  assert.equal(result.versionProbe.stdout.trim(), process.version)
  assert.equal(result.versionProbe.stderr, '')
  assert.equal(result.versionProbe.exitCode, 0)
  assert.equal(result.versionProbe.timedOut, false)
  assert.equal(result.versionProbe.outputLimited, false)
  assert.equal(result.versionProbe.error, null)
  assert.ok(Number.isFinite(result.versionProbe.startedAtMs))
  assert.ok(result.versionProbe.finishedAtMs >= result.versionProbe.startedAtMs)
})

test('inventory preserves raw process diagnostics when the version probe cannot execute', async t => {
  const options = inventoryFixture(t)
  options.executable = path.join(options.root, 'broken-godot.exe')
  fs.writeFileSync(options.executable, 'not an executable\n')
  options.lock.executableSha256 = createHash('sha256').update(fs.readFileSync(options.executable)).digest('hex')
  fs.writeFileSync(options.lockPath, JSON.stringify(options.lock))
  const result = await inspectGodot(options)
  assert.equal(result.ready, false)
  assert.ok(result.blockers.includes('VERSION_PROBE_FAILED'))
  assert.equal(result.versionProbe.stdout, '')
  assert.equal(result.versionProbe.stderr, '')
  assert.notEqual(result.versionProbe.exitCode, 0)
  assert.match(result.versionProbe.error, /spawn|ENOEXEC|EACCES|EINVAL|ENOENT|UNKNOWN/i)
  assert.equal(result.versionProbe.timedOut, false)
  assert.equal(result.versionProbe.outputLimited, false)
})

test('inventory rejects executable and template payload mutations', async t => {
  const options = inventoryFixture(t)
  options.lock.executableSha256 = '0'.repeat(64)
  fs.writeFileSync(options.lockPath, JSON.stringify(options.lock))
  let result = await inspectGodot(options)
  assert.ok(result.blockers.includes('EXECUTABLE_HASH_MISMATCH'))
  options.lock.executableSha256 = createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')
  fs.writeFileSync(options.lockPath, JSON.stringify(options.lock))
  fs.writeFileSync(path.join(options.templates, 'web_nothreads_release.zip'), 'mutated')
  result = await inspectGodot(options)
  assert.ok(result.blockers.includes('TEMPLATE_HASH_MISMATCH:web_nothreads_release.zip'))
})

test('inventory rejects absent and mismatched template versions or incomplete locks', async t => {
  const options = inventoryFixture(t)
  fs.unlinkSync(path.join(options.templates, 'windows_release_x86_64.exe'))
  let result = await inspectGodot(options)
  assert.ok(result.blockers.includes('TEMPLATE_MISSING:windows_release_x86_64.exe'))
  fs.writeFileSync(path.join(options.templates, 'version.txt'), '4.6.stable')
  result = await inspectGodot(options)
  assert.ok(result.blockers.includes('TEMPLATE_VERSION_MISMATCH'))
  delete options.lock.templates['web_nothreads_debug.zip']
  fs.writeFileSync(options.lockPath, JSON.stringify(options.lock))
  result = await inspectGodot(options)
  assert.ok(result.blockers.includes('LOCK_INVALID'))
})

test('inventory blocks missing executable/project/lock without spawning or installing', async t => {
  const { root } = fixture(t)
  const result = await inspectGodot({ executable: path.join(root, 'missing.exe'), project: path.join(root, 'missing-project'), templates: path.join(root, 'missing-templates'), lockPath: path.join(root, 'missing-lock.json') })
  assert.equal(result.ready, false)
  assert.ok(result.blockers.includes('EXECUTABLE_MISSING'))
  assert.ok(result.blockers.includes('PROJECT_MISSING'))
  assert.ok(result.blockers.includes('LOCK_INVALID'))
  assert.equal(fs.existsSync(path.join(root, 'missing-templates')), false)
})
