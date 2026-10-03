import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspectUnityPreflight, parseArguments } from '../lib/unity-preflight.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const temporaryParent = path.join(repo, 'release', 'e02')
fs.mkdirSync(temporaryParent, { recursive: true })

function removeTaskDirectory(target, boundary) {
  const resolved = fs.realpathSync(target)
  const relative = path.relative(fs.realpathSync(boundary), resolved)
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  fs.rmSync(resolved, { recursive: true, force: true })
}

function fixture() {
  const root = fs.mkdtempSync(path.join(temporaryParent, 'preflight-test-'))
  const proposal = JSON.parse(fs.readFileSync(path.join(repo, 'docs/engineering/e02-unity.proposed.json'), 'utf8'))
  proposal.decisionStatus = 'ACCEPTED'
  proposal.acceptedDecisionRecord = 'docs/engineering/e02-test-decision.md'
  const project = path.join(root, proposal.projectRelativePath)
  const editor = path.join(root, 'installed editor', 'Editor', 'Unity.exe')
  const put = (relative, value) => {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, value)
  }
  put(proposal.acceptedDecisionRecord, 'Synthetic decision fixture; never a human approval.\n')
  put(path.relative(root, editor), 'Synthetic file; never an executable.\n')
  fs.mkdirSync(path.join(path.dirname(editor), 'Data/PlaybackEngines/windowsstandalonesupport'), { recursive: true })
  put(path.relative(root, path.join(project, 'ProjectSettings/ProjectVersion.txt')),
    'm_EditorVersion: 6000.6.4f1\nm_EditorVersionWithRevision: 6000.6.4f1 (12bfff696524)\n')
  put(path.relative(root, path.join(project, 'Packages/manifest.json')),
    JSON.stringify({ dependencies: proposal.packages }))
  for (const asset of Object.keys(proposal.preservedAssets)) {
    const bytes = Buffer.from(`synthetic ${asset}`)
    put(asset, bytes)
    proposal.preservedAssets[asset] = createHash('sha256').update(bytes).digest('hex')
  }
  let versionReads = 0
  const options = { root, editorPath: editor, contract: proposal, output: 'release/e02/new-run' }
  const io = { readEditorVersion: () => { versionReads++; return '6000.6.4f1_12bfff696524' } }
  return {
    root, project, editor, proposal, put, options, io,
    get versionReads() { return versionReads },
    inspect: () => inspectUnityPreflight(options, io),
    dispose: () => removeTaskDirectory(root, temporaryParent),
  }
}

function withFixture(name, callback) {
  test(name, () => {
    const current = fixture()
    try { callback(current) } finally { current.dispose() }
  })
}

function rejects(current, code) {
  const result = current.inspect()
  assert.equal(result.ready, false)
  assert.ok(result.blockers.some(item => item.code === code), JSON.stringify(result.blockers))
  assert.equal(result.unityProcessStarted, false)
  assert.equal(result.engineExecutionSupported, false)
  assert.equal(result.engineEvidence.compile, 'NOT_RUN')
  return result
}

withFixture('synthetic complete input is only a read-only precheck', current => {
  const result = current.inspect()
  assert.equal(result.ready, true)
  assert.equal(result.result, 'PRECHECK_ONLY')
  assert.equal(result.unityProcessStarted, false)
  assert.equal(result.engineExecutionSupported, false)
  assert.equal(result.decisionEvidence, 'DECLARED_RECORD_NOT_AUTHENTICATED_APPROVAL')
  assert.deepEqual(Object.values(result.engineEvidence), Array(7).fill('NOT_RUN'))
  assert.equal(fs.existsSync(path.join(current.root, current.options.output)), false)
})

withFixture('a proposed ADR blocks readiness', current => {
  current.proposal.decisionStatus = 'PROPOSED'
  rejects(current, 'ADR_NOT_ACCEPTED')
})

withFixture('accepted declaration without a decision record blocks readiness', current => {
  current.proposal.acceptedDecisionRecord = null
  rejects(current, 'DECISION_RECORD_MISSING')
})

withFixture('decision record may not read outside the checkout', current => {
  current.proposal.acceptedDecisionRecord = '../outside-decision.md'
  rejects(current, 'DECISION_RECORD_PATH_INVALID')
})

withFixture('missing editor does not invoke even the file-version probe', current => {
  fs.unlinkSync(current.editor)
  rejects(current, 'EDITOR_MISSING')
  assert.equal(current.versionReads, 0)
})

withFixture('unknown executable name is rejected before the version probe', current => {
  current.options.editorPath = path.join(path.dirname(current.editor), 'unknown.exe')
  rejects(current, 'EDITOR_PATH_INVALID')
  assert.equal(current.versionReads, 0)
})

withFixture('wrong Editor version is rejected', current => {
  current.io.readEditorVersion = () => '6000.6.3f1_12bfff696524'
  rejects(current, 'EDITOR_VERSION_MISMATCH')
})

withFixture('same Editor version with another revision is rejected', current => {
  current.io.readEditorVersion = () => '6000.6.4f1_aaaaaaaaaaaa'
  rejects(current, 'EDITOR_VERSION_MISMATCH')
})

withFixture('failed file-version probe remains a tool failure', current => {
  current.io.readEditorVersion = () => { throw new Error('synthetic probe unavailable') }
  const result = rejects(current, 'EDITOR_VERSION_PROBE_FAILED')
  assert.equal(result.blockers.find(item => item.code === 'EDITOR_VERSION_PROBE_FAILED').classification, 'TOOL_FAILURE')
})

withFixture('missing Windows playback engine is rejected', current => {
  fs.rmdirSync(path.join(path.dirname(current.editor), 'Data/PlaybackEngines/windowsstandalonesupport'))
  rejects(current, 'PLAYBACK_ENGINE_MISSING')
})

withFixture('missing project is not confused with an installed Editor', current => {
  removeTaskDirectory(current.project, current.root)
  rejects(current, 'PROJECT_MISSING')
})

withFixture('wrong project Editor revision is rejected', current => {
  current.put(path.relative(current.root, path.join(current.project, 'ProjectSettings/ProjectVersion.txt')),
    'm_EditorVersion: 6000.6.4f1\nm_EditorVersionWithRevision: 6000.6.4f1 (bbbbbbbbbbbb)\n')
  rejects(current, 'PROJECT_VERSION_MISMATCH')
})

withFixture('missing project version is rejected', current => {
  fs.unlinkSync(path.join(current.project, 'ProjectSettings/ProjectVersion.txt'))
  rejects(current, 'PROJECT_VERSION_MISSING')
})

withFixture('another URP package version is rejected', current => {
  current.put(path.relative(current.root, path.join(current.project, 'Packages/manifest.json')),
    JSON.stringify({ dependencies: { ...current.proposal.packages, 'com.unity.render-pipelines.universal': '17.5.0' } }))
  rejects(current, 'PACKAGE_VERSION_MISMATCH')
})

withFixture('missing test framework package is rejected', current => {
  current.put(path.relative(current.root, path.join(current.project, 'Packages/manifest.json')),
    JSON.stringify({ dependencies: { 'com.unity.render-pipelines.universal': '17.6.0' } }))
  rejects(current, 'PACKAGE_VERSION_MISMATCH')
})

withFixture('malformed package manifest is retained as an invalid input', current => {
  current.put(path.relative(current.root, path.join(current.project, 'Packages/manifest.json')), '{invalid')
  rejects(current, 'PROJECT_MANIFEST_INVALID')
})

withFixture('a Unity lockfile prevents using a possibly occupied project', current => {
  current.put(path.relative(current.root, path.join(current.project, 'Temp/UnityLockfile')), '')
  rejects(current, 'PROJECT_POSSIBLY_IN_USE')
})

withFixture('changed preserved GLB is rejected', current => {
  current.put('public/models/zhaoyun.glb', 'different bytes')
  rejects(current, 'ASSET_HASH_MISMATCH')
})

withFixture('missing preserved asset is rejected', current => {
  fs.unlinkSync(path.join(current.root, 'public/models/zhaoyun.manifest.json'))
  rejects(current, 'ASSET_MISSING')
})

withFixture('project path cannot escape or silently select another project', current => {
  current.proposal.projectRelativePath = '../user-project'
  rejects(current, 'PROJECT_PATH_INVALID')
})

withFixture('output cannot escape release/e02', current => {
  current.options.output = '../outside-output'
  rejects(current, 'OUTPUT_PATH_INVALID')
})

withFixture('existing output evidence is rejected without overwriting it', current => {
  current.put(`${current.options.output}/preserved.txt`, 'keep this')
  rejects(current, 'OUTPUT_EXISTS')
  assert.equal(fs.readFileSync(path.join(current.root, current.options.output, 'preserved.txt'), 'utf8'), 'keep this')
})

withFixture('reparse/symlink output parent is rejected', current => {
  fs.mkdirSync(path.join(current.root, 'release'))
  current.io.lstat = target => {
    if (target === path.join(current.root, 'release')) {
      return { isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false }
    }
    return fs.lstatSync(target)
  }
  rejects(current, 'OUTPUT_PATH_INVALID')
})

withFixture('dangling output link is rejected even when exists returns false', current => {
  const link = path.join(current.root, current.options.output)
  assert.equal(fs.existsSync(link), false)
  current.io.lstat = target => target === link
    ? { isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false }
    : fs.lstatSync(target)
  rejects(current, 'OUTPUT_PATH_INVALID')
})

withFixture('ordinary file cannot be an output parent directory', current => {
  current.put('release', 'This is an existing file, not a directory')
  rejects(current, 'OUTPUT_PATH_INVALID')
  assert.equal(fs.readFileSync(path.join(current.root, 'release'), 'utf8'), 'This is an existing file, not a directory')
})

withFixture('unreviewed build backend change is rejected', current => {
  current.proposal.scriptingBackend = 'IL2CPP'
  rejects(current, 'CONTRACT_UNSUPPORTED')
})

test('inventory is the default; --execute is never accepted', () => {
  assert.equal(parseArguments([]).mode, 'inventory')
  assert.throws(() => parseArguments(['--execute']), /Unknown argument/)
})

test('duplicate and missing arguments are rejected', () => {
  assert.throws(() => parseArguments(['--editor']), /Missing value/)
  assert.throws(() => parseArguments(['--mode', 'inventory', '--mode', 'preflight']), /Duplicate argument/)
  assert.throws(() => parseArguments(['--mode', 'run']), /Unsupported mode/)
})

test('paths with spaces stay a single argument', () => {
  const result = parseArguments(['--mode', 'preflight', '--editor', 'C:\\Program Files\\Unity\\Unity.exe'])
  assert.equal(result.editorPath, 'C:\\Program Files\\Unity\\Unity.exe')
})
