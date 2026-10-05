import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { requireSafeEngineWrites, validateExecutionScope, validatePackagePolicy, validateUnchangedSource, validateCandidateCheckout, validatePackageLock, validateResolvedPackage, validateTestSummary, validateSettings, validateRuntime, fixedDependencies } from '../lib/unity-execution.mjs'
import { readUnityTestResults } from '../lib/unity-test-results.mjs'

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const contract = JSON.parse(fs.readFileSync(new URL('../../docs/engineering/e02-unity.proposed.json', import.meta.url)))
const policy = JSON.parse(fs.readFileSync(new URL('../../unity/ChangshanLongdan/e02-package-policy.json', import.meta.url)))
const copy = value => structuredClone(value)

test('real XML parser accepts a synthetic NUnit case and rejects malformed, missing, DTD, zero and skipped results', () => {
  const boundary = path.join(root, 'release/e02')
  fs.mkdirSync(boundary, { recursive: true })
  const temporary = fs.mkdtempSync(path.join(boundary, 'xml-test-'))
  const filename = path.join(temporary, 'synthetic.xml')
  try {
    const valid = '<test-run result="Passed" total="1" passed="1" failed="0" skipped="0" inconclusive="0"><test-case fullname="Synthetic.Only" result="Passed" /></test-run>'
    fs.writeFileSync(filename, valid)
    assert.equal(readUnityTestResults(filename).total, 1)
    for (const invalid of ['<broken>', valid.replace(' failed="0"', ''),
      '<!DOCTYPE test-run [<!ENTITY x SYSTEM "file:///not-read">]>' + valid,
      '<test-run result="Passed" total="0" passed="0" failed="0" skipped="0" inconclusive="0" />',
      valid.replace('result="Passed" /></test-run>', 'result="Skipped" /></test-run>')]) {
      fs.writeFileSync(filename, invalid)
      assert.throws(() => readUnityTestResults(filename))
    }
    assert.throws(() => readUnityTestResults(path.join(temporary, 'missing.xml')), /TEST_XML_MISSING/)
  } finally {
    const absolute = fs.realpathSync(temporary)
    const relative = path.relative(fs.realpathSync(boundary), absolute)
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
    fs.rmSync(absolute, { recursive: true, force: true })
  }
})

test('Library and nested UPM cache junctions block before any engine launch', () => {
  const boundary = path.join(root, 'release/e02')
  fs.mkdirSync(boundary, { recursive: true })
  const temporary = fs.mkdtempSync(path.join(boundary, 'engine-write-test-'))
  try {
    const project = path.join(temporary, 'project')
    const cache = path.join(temporary, 'cache')
    const other = path.join(temporary, 'other')
    for (const name of [project, cache, other]) fs.mkdirSync(name)
    requireSafeEngineWrites(temporary, project, cache)
    fs.symlinkSync(other, path.join(project, 'Library'), 'junction')
    assert.throws(() => requireSafeEngineWrites(temporary, project, cache), /UNSAFE_PATH|UNSAFE_ENGINE_WRITE/)
    fs.unlinkSync(path.join(project, 'Library'))
    fs.symlinkSync(other, path.join(cache, 'nested'), 'junction')
    assert.throws(() => requireSafeEngineWrites(temporary, project, cache), /UNSAFE_PATH|UNSAFE_ENGINE_WRITE/)
    fs.unlinkSync(path.join(cache, 'nested'))
  } finally {
    const absolute = fs.realpathSync(temporary)
    const relative = path.relative(fs.realpathSync(boundary), absolute)
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
    fs.rmSync(absolute, { recursive: true, force: true })
  }
})

test('fixed accepted scope and exact manifest pass pure validation only', () => {
  validateExecutionScope(contract, { dependencies: fixedDependencies })
  validatePackagePolicy(policy)
})
test('package policy cannot authorize another version, registry, extra package or changed checksum', () => {
  for (const mutate of [p => { p.packages['com.unity.burst'].version = '2.0.1' },
    p => { p.registry = 'https://example.com' }, p => { p.packages.extra = { version: '1.0.0', source: 'builtin' } },
    p => { p.packages['com.unity.searcher'].sha1 = '0'.repeat(40) }]) {
    const changed = copy(policy); mutate(changed)
    assert.throws(() => validatePackagePolicy(changed), /PACKAGE_POLICY_SCOPE_MISMATCH/)
  }
})
test('no stage, compile included, may change, add or remove a snapshotted file', () => {
  const before = { 'src/game.ts': 'a', 'unity/ChangshanLongdan/Assets/Foundation/Runtime/A.cs': 'b',
    'unity/ChangshanLongdan/Assets/Foundation/Settings/FoundationURP.asset': 'c', 'unity/ChangshanLongdan/Assets/Foundation/Scenes/Foundation.unity.meta': 'd',
    'unity/ChangshanLongdan/ProjectSettings/ProjectSettings.asset': 'e', 'unity/ChangshanLongdan/Packages/manifest.json': 'f' }
  validateUnchangedSource(before, copy(before))
  for (const name of Object.keys(before)) {
    // Configure rewriting a committed setting is a rejected candidate, not a silent repair.
    assert.throws(() => validateUnchangedSource(before, { ...before, [name]: 'rewritten' }), /SOURCE_CHANGED_DURING_RUN/)
    const removed = copy(before); delete removed[name]
    assert.throws(() => validateUnchangedSource(before, removed), /SOURCE_CHANGED_DURING_RUN/)
  }
  assert.throws(() => validateUnchangedSource(before, { ...before, 'unity/ChangshanLongdan/Assets/Generated.asset': 'new' }), /SOURCE_CHANGED_DURING_RUN/)
  assert.throws(() => validateUnchangedSource(before, { ...before, 'unity/ChangshanLongdan/Assets/Other.cs.meta': 'new' }), /SOURCE_CHANGED_DURING_RUN/)
  assert.throws(() => validateUnchangedSource(before, undefined), /SOURCE_CHANGED_DURING_RUN/)
})
test('the recorded head requires a readable commit and a checkout without modified or untracked files', () => {
  const head = '552fab9b2d573c9ffcd54a238af94f0af5589789'
  assert.equal(validateCandidateCheckout(head, ''), head)
  for (const unreadable of ['', '552fab9', head.toUpperCase(), head + '\n', 'HEAD', undefined, null])
    assert.throws(() => validateCandidateCheckout(unreadable, ''), /CANDIDATE_HEAD_UNREADABLE/)
  for (const status of [' M unity/ChangshanLongdan/ProjectSettings/ProjectSettings.asset\n', '?? unity/ChangshanLongdan/Assets/Extra.cs\n', ' ', undefined])
    assert.throws(() => validateCandidateCheckout(head, status), /CHECKOUT_NOT_CLEAN/)
})
test('missing or nonfinite Player frame count cannot pass', () => {
  const report = { runId: 'current', unityVersion: '6000.6.4f1', graphicsApi: 'Direct3D11', pipeline: 'UniversalRenderPipelineAsset',
    colorSpace: 'Linear', width: 1920, height: 1080, targetFrameRate: 60, vSyncCount: 1, renderScale: 1,
    errorCount: 0, batchMode: false, screenshot: 'missing.png' }
  assert.throws(() => validateRuntime(report, 'current', path.resolve('missing.png')), /RUNTIME_SETTINGS_MISMATCH/)
  assert.throws(() => validateRuntime({ ...report, frameCount: NaN }, 'current', path.resolve('missing.png')), /RUNTIME_SETTINGS_MISMATCH/)
})
for (const [key, value] of Object.entries({ editorVersion: '6000.6.3f1', editorRevision: '000000000000',
  animatorRootMotion: true, movementAuthority: 'animator', graphicsApi: 'Vulkan', webRetained: false,
  externalGenerationEnabled: true, spendLimitUsd: 1, decisionStatus: 'PROPOSED' })) {
  test(`execution refuses changed ${key} without launching Unity`, () => {
    const changed = copy(contract); changed[key] = value
    assert.throws(() => validateExecutionScope(changed, { dependencies: fixedDependencies }), /EXECUTION_SCOPE_MISMATCH/)
  })
}
test('execution refuses changed package and render resolution', () => {
  const changed = copy(contract); changed.packages['com.unity.test-framework'] = '1.7.0'
  assert.throws(() => validateExecutionScope(changed, { dependencies: fixedDependencies }))
  changed.packages = contract.packages; changed.renderCandidate.width = 1280
  assert.throws(() => validateExecutionScope(changed, { dependencies: fixedDependencies }))
})
test('manifest rejects extra dependency, registry and unpinned source', () => {
  assert.throws(() => validateExecutionScope(contract, { dependencies: { ...fixedDependencies, 'com.unity.ai.navigation': '2.0.12' } }))
  assert.throws(() => validateExecutionScope(contract, { dependencies: fixedDependencies, scopedRegistries: [] }))
  assert.throws(() => validateExecutionScope(contract, { dependencies: { ...fixedDependencies, 'com.unity.test-framework': 'file:../other' } }))
})
test('lock enforces exact actual set, versions and official registry', () => {
  const lock = { dependencies: Object.fromEntries(Object.entries(policy.packages).map(([name, item]) => [name,
    { version: item.version, source: item.source, ...(item.source === 'registry' ? { url: 'https://packages.unity.com' } : {}) }])) }
  validatePackageLock(lock, policy)
  const changed = copy(lock); changed.dependencies['com.unity.searcher'].url = 'https://example.com'
  assert.throws(() => validatePackageLock(changed, policy))
  changed.dependencies['com.unity.searcher'].url = 'https://packages.unity.com'
  changed.dependencies['com.unity.searcher'].version = '4.9.6'
  assert.throws(() => validatePackageLock(changed, policy))
  delete changed.dependencies['com.unity.searcher']
  assert.throws(() => validatePackageLock(changed, policy))
})
test('installed packages must equal their verified manifest apart from the Unity fingerprint stamp', () => {
  const sha1 = policy.packages['com.unity.searcher'].sha1
  const registry = { ...policy.packages['com.unity.searcher'] }
  const builtin = { ...policy.packages['com.unity.burst'] }
  const reference = (name, version) => ({ name, version, dependencies: { 'com.unity.modules.imgui': '1.0.0' }, keywords: ['a', 'b'] })
  const searcher = reference('com.unity.searcher', '4.9.5')
  const burst = reference('com.unity.burst', '2.0.0')
  const stamp = '626e66ab421bf31cfa602bb20675290e2a514b01'
  // Key order and the stamp may differ; a built-in module carries no stamp and keeps its bare directory name.
  validateResolvedPackage('com.unity.searcher', registry, 'com.unity.searcher@' + sha1.slice(0, 12),
    { _fingerprint: sha1, keywords: ['a', 'b'], dependencies: { 'com.unity.modules.imgui': '1.0.0' }, version: '4.9.5', name: 'com.unity.searcher' }, searcher)
  validateResolvedPackage('com.unity.burst', builtin, 'com.unity.burst@' + stamp.slice(0, 12), { ...burst, _fingerprint: stamp }, burst)
  validateResolvedPackage('com.unity.burst', builtin, 'com.unity.burst', burst, burst)
  const installed = { ...searcher, _fingerprint: sha1 }
  const directory = 'com.unity.searcher@' + sha1.slice(0, 12)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, directory, { ...installed, version: '4.9.6' }, searcher), /VERSION_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, directory, { ...installed, keywords: ['b', 'a'] }, searcher), /MANIFEST_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, directory, { ...installed, scripts: {} }, searcher), /MANIFEST_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, directory, installed, { ...searcher, _fingerprint: sha1 }), /MANIFEST_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, 'com.unity.searcher@000000000000', installed, searcher), /PATH_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, 'com.unity.searcher', installed, searcher), /PATH_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, 'com.unity.searcher@' + stamp.slice(0, 12), { ...searcher, _fingerprint: stamp }, searcher), /FINGERPRINT_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.searcher', registry, 'com.unity.searcher', searcher, searcher), /FINGERPRINT_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.burst', builtin, 'com.unity.burst@' + stamp.slice(0, 12), burst, burst), /PATH_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.burst', builtin, 'com.unity.burst@626e66ab421b', { ...burst, _fingerprint: '626e66ab421b' }, burst), /PATH_MISMATCH/)
  assert.throws(() => validateResolvedPackage('com.unity.burst', builtin, 'com.unity.burst', undefined, burst), /VERSION_MISMATCH/)
})
const passed = { result: 'Passed', total: 3, passed: 3, failed: 0, skipped: 0, inconclusive: 0, caseCount: 3, badCaseCount: 0 }
test('XML summary requires actual passed cases, never exit zero alone', () => validateTestSummary(passed))
for (const mutation of [{ total: 0, passed: 0, caseCount: 0 }, { skipped: 1 }, { inconclusive: 1 },
  { failed: 1 }, { result: 'Failed' }, { caseCount: 2 }, { badCaseCount: 1 }, { total: NaN }]) {
  test(`XML rejects ${JSON.stringify(mutation)}`, () => assert.throws(() => validateTestSummary({ ...passed, ...mutation })))
}
test('settings requires current nonce, effective values and real successful build', () => {
  const report = { runId: 'current', stage: 'build', unityVersion: '6000.6.4f1', revision: '12bfff696524',
    projectPath: root, backend: 'Mono2x', graphicsApi: 'Direct3D11', colorSpace: 'Linear', width: 1920, height: 1080,
    targetFrameRate: 60, vSyncCount: 1, pipeline: 'UniversalRenderPipelineAsset', renderScale: 1,
    buildResult: 'Succeeded', buildErrors: 0, buildBytes: 100,
    packages: Object.entries(policy.packages).map(([name, item]) => ({ name, version: item.version, source: item.source })) }
  validateSettings(report, 'current', root, 'build', policy)
  assert.throws(() => validateSettings(report, 'old', root, 'build', policy))
  assert.throws(() => validateSettings({ ...report, graphicsApi: 'Vulkan' }, 'current', root, 'build', policy))
  assert.throws(() => validateSettings({ ...report, buildResult: 'Failed' }, 'current', root, 'build', policy))
  assert.throws(() => validateSettings({ ...report, buildBytes: 0 }, 'current', root, 'build', policy))
  assert.throws(() => validateSettings({ ...report, buildBytes: undefined }, 'current', root, 'build', policy))
  assert.throws(() => validateSettings({ ...report, buildBytes: NaN }, 'current', root, 'build', policy))
})
