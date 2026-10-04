import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { requireSafeEngineWrites, validateExecutionScope, validatePackagePolicy, validateImmutableSource, validatePackageLock, validateTestSummary, validateSettings, fixedDependencies } from '../lib/unity-execution.mjs'

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const contract = JSON.parse(fs.readFileSync(new URL('../../docs/engineering/e02-unity.proposed.json', import.meta.url)))
const policy = JSON.parse(fs.readFileSync(new URL('../../unity/ChangshanLongdan/e02-package-policy.json', import.meta.url)))
const copy = value => structuredClone(value)

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
test('engine-generated settings do not permit immutable source changes', () => {
  const before = { 'src/game.ts': 'a', 'unity/ChangshanLongdan/Assets/Foundation/Runtime/A.cs': 'b' }
  validateImmutableSource(before, { ...before, 'unity/ChangshanLongdan/Assets/Foundation/Settings/X.asset': 'generated' })
  assert.throws(() => validateImmutableSource(before, { ...before, 'src/game.ts': 'changed' }))
  assert.throws(() => validateImmutableSource(before, { ...before, 'unity/ChangshanLongdan/Assets/Other.cs': 'new' }))
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
})
