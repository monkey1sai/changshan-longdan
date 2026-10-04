import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const fixedDependencies = Object.freeze({
  'com.unity.render-pipelines.universal': '17.6.0',
  'com.unity.test-framework': '1.8.0',
  'com.unity.profiling.core': '1.0.3',
  'com.unity.searcher': '4.9.5',
  'com.unity.nuget.mono-cecil': '1.11.6',
  'com.unity.modules.screencapture': '1.0.0',
})

export function validatePackagePolicy(policy) {
  const builtinVersions = {
    'com.unity.render-pipelines.universal': '17.6.0', 'com.unity.render-pipelines.core': '17.6.0',
    'com.unity.render-pipelines.universal-config': '17.6.0', 'com.unity.shadergraph': '17.6.0',
    'com.unity.graph-authoring': '1.0.0', 'com.unity.burst': '2.0.0', 'com.unity.collections': '6.6.0',
    'com.unity.test-framework': '1.8.0', 'com.unity.ext.nunit': '2.1.0', 'com.unity.test-framework.performance': '6.6.0',
    'com.unity.modules.imgui': '1.0.0', 'com.unity.modules.jsonserialize': '1.0.0',
    'com.unity.modules.screencapture': '1.0.0', 'com.unity.modules.imageconversion': '1.0.0',
  }
  const registryHashes = {
    'com.unity.profiling.core': '8a49f7027d0618e2cb86aa9e4ed5fb4392e8121a',
    'com.unity.searcher': 'a463122f2c00f83398f41790942a0793431e70ea',
    'com.unity.nuget.mono-cecil': 'ecb9724e46fff855c46a4f37f0a3377a3cfffc06',
  }
  if (policy.schemaVersion !== 1 || policy.registry !== 'https://packages.unity.com' ||
      Object.keys(policy.packages ?? {}).length !== Object.keys(builtinVersions).length + Object.keys(registryHashes).length)
    throw new Error('PACKAGE_POLICY_SCOPE_MISMATCH')
  for (const [name, version] of Object.entries(builtinVersions)) {
    if (!sameObject(policy.packages[name], { version, source: 'builtin' })) throw new Error(`PACKAGE_POLICY_SCOPE_MISMATCH: ${name}`)
  }
  for (const [name, sha1] of Object.entries(registryHashes)) {
    if (!sameObject(policy.packages[name], { version: fixedDependencies[name], source: 'registry', sha1 }))
      throw new Error(`PACKAGE_POLICY_SCOPE_MISMATCH: ${name}`)
  }
}

export function validateImmutableSource(before, after) {
  const immutable = name => /^(src\/|public\/|scripts\/)/.test(name) || /\.(cs|asmdef)$/.test(name) ||
    ['index.html', 'package-lock.json', 'vite.config.ts', 'docs/engineering/e02-unity.proposed.json',
      'docs/engineering/E02_DECISION.md', 'unity/ChangshanLongdan/e02-package-policy.json', 'unity/ChangshanLongdan/.e02-project.json'].includes(name)
  const expected = Object.fromEntries(Object.entries(before).filter(([name]) => immutable(name)))
  const actual = Object.fromEntries(Object.entries(after).filter(([name]) => immutable(name)))
  if (!sameObject(actual, expected)) throw new Error('SOURCE_CHANGED_DURING_RUN')
}

export function validateFrozenSource(before, after) {
  if (!sameObject(after, before)) throw new Error('EFFECTIVE_SOURCE_CHANGED_AFTER_COMPILE')
}

export function validateExecutionScope(contract, manifest) {
  const exact = {
    schemaVersion: 1, decisionStatus: 'ACCEPTED', acceptedDecisionRecord: 'docs/engineering/E02_DECISION.md',
    editorVersion: '6000.6.4f1', editorRevision: '12bfff696524', projectRelativePath: 'unity/ChangshanLongdan',
    renderPipeline: 'URP', buildTarget: 'StandaloneWindows64', scriptingBackend: 'Mono', graphicsApi: 'Direct3D11',
    requiredPlaybackEngine: 'windowsstandalonesupport', webRetained: true,
    movementAuthority: 'gameplay-controller', animatorRootMotion: false, externalGenerationEnabled: false, spendLimitUsd: 0,
  }
  for (const [key, value] of Object.entries(exact)) {
    if (contract[key] !== value) throw new Error(`EXECUTION_SCOPE_MISMATCH: ${key}`)
  }
  const render = { width: 1920, height: 1080, renderScale: 1, targetFrameRate: 60, vSyncCount: 1, colorSpace: 'Linear' }
  if (!sameObject(contract.renderCandidate, render) || !sameObject(contract.packages, {
    'com.unity.render-pipelines.universal': '17.6.0', 'com.unity.test-framework': '1.8.0',
  })) throw new Error('EXECUTION_SCOPE_MISMATCH: rendering or packages')
  if (!sameObject(contract.preservedAssets, {
    'public/models/zhaoyun.glb': '7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33',
    'public/models/zhaoyun.manifest.json': 'b0662f373bc2349095d49cdc6a28edba9b6a9658dcd23c5a0dc60b96d93a1f2d',
  })) throw new Error('EXECUTION_SCOPE_MISMATCH: preserved assets')
  if (!sameObject(manifest.dependencies, fixedDependencies) || Object.keys(manifest).some(key => key !== 'dependencies'))
    throw new Error('MANIFEST_SCOPE_MISMATCH: extra dependency, registry or override')
}

function sameObject(actual, expected) {
  return actual && Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
}

// Revalidate before every write/spawn; refuse links, broken links and non-directory ancestors.
export function requireSafePath(root, target) {
  root = fs.realpathSync(root)
  target = path.resolve(target)
  const relative = path.relative(root, target)
  if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
    throw new Error('UNSAFE_PATH: outside checkout')
  const parts = relative.split(path.sep)
  let current = root
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i])
    let stat
    try { stat = fs.lstatSync(current) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw new Error('UNSAFE_PATH: link or non-directory ancestor')
    const actual = path.relative(root, fs.realpathSync(current))
    if (!actual || path.isAbsolute(actual) || actual === '..' || actual.startsWith(`..${path.sep}`)) throw new Error('UNSAFE_PATH: resolved boundary')
  }
  return target
}

export function requireSafeEngineWrites(root, project, cache) {
  const visit = target => {
    requireSafePath(root, target)
    let stat
    try { stat = fs.lstatSync(target) } catch (error) { if (error.code === 'ENOENT') return; throw error }
    if (stat.isSymbolicLink()) throw new Error('UNSAFE_ENGINE_WRITE: link')
    if (stat.isDirectory()) for (const name of fs.readdirSync(target)) visit(path.join(target, name))
  }
  // Include source trees as well: the Editor creates meta/settings files during import.
  visit(project)
  visit(cache)
}

export function validatePackageLock(lock, policy) {
  const entries = lock?.dependencies
  if (!entries || Object.keys(entries).length !== Object.keys(policy.packages).length) throw new Error('PACKAGE_LOCK_MISMATCH: package set')
  for (const [name, expected] of Object.entries(policy.packages)) {
    const actual = entries[name]
    if (!actual || actual.version !== expected.version || actual.source !== expected.source ||
        (actual.source === 'registry' && actual.url !== 'https://packages.unity.com'))
      throw new Error(`PACKAGE_LOCK_MISMATCH: ${name}`)
    if (Object.keys(actual.dependencies ?? {}).some(dependency => !policy.packages[dependency]))
      throw new Error(`PACKAGE_LOCK_MISMATCH: unexpected transitive dependency in ${name}`)
  }
}

export function validateTestSummary(summary) {
  for (const key of ['total', 'passed', 'failed', 'skipped', 'inconclusive', 'caseCount', 'badCaseCount']) {
    if (!Number.isInteger(summary[key]) || summary[key] < 0) throw new Error(`INVALID_TEST_XML: ${key}`)
  }
  if (summary.result !== 'Passed' || summary.total < 1 || summary.passed !== summary.total ||
      summary.failed !== 0 || summary.skipped !== 0 || summary.inconclusive !== 0 ||
      summary.caseCount !== summary.total || summary.badCaseCount !== 0)
    throw new Error('TESTS_NOT_PASSED: zero, failed, skipped, inconclusive or inconsistent cases')
  return summary
}

export function validateSettings(report, runId, project, stage, policy) {
  if (report.runId !== runId || report.stage !== stage || report.unityVersion !== '6000.6.4f1' ||
      report.revision !== '12bfff696524' || path.resolve(report.projectPath) !== project ||
      report.backend !== 'Mono2x' || report.graphicsApi !== 'Direct3D11' || report.colorSpace !== 'Linear' ||
      report.width !== 1920 || report.height !== 1080 || report.targetFrameRate !== 60 || report.vSyncCount !== 1 ||
      report.pipeline !== 'UniversalRenderPipelineAsset' || report.renderScale !== 1)
    throw new Error('EFFECTIVE_SETTINGS_MISMATCH')
  const packages = report.packages
  if (!Array.isArray(packages) || packages.length !== Object.keys(policy.packages).length ||
      new Set(packages.map(item => item.name)).size !== packages.length) throw new Error('EFFECTIVE_PACKAGES_MISMATCH: set')
  for (const item of packages) {
    const expected = policy.packages[item.name]
    if (!expected || item.version !== expected.version || item.source.toLowerCase() !== expected.source)
      throw new Error(`EFFECTIVE_PACKAGES_MISMATCH: ${item.name}`)
  }
  if (stage === 'build' && (report.buildResult !== 'Succeeded' || report.buildErrors !== 0 ||
      !Number.isSafeInteger(report.buildBytes) || report.buildBytes <= 0))
    throw new Error('BUILD_NOT_SUCCEEDED')
}

export function validateRuntime(report, runId, imagePath) {
  if (report.runId !== runId || report.unityVersion !== '6000.6.4f1' || report.graphicsApi !== 'Direct3D11' ||
      report.pipeline !== 'UniversalRenderPipelineAsset' || report.colorSpace !== 'Linear' || report.width !== 1920 ||
      report.height !== 1080 || report.targetFrameRate !== 60 || report.vSyncCount !== 1 || report.renderScale !== 1 ||
      !Number.isSafeInteger(report.frameCount) || report.frameCount < 120 || report.errorCount !== 0 || report.batchMode !== false ||
      path.resolve(report.screenshot) !== imagePath) throw new Error('RUNTIME_SETTINGS_MISMATCH')
  const image = fs.readFileSync(imagePath)
  if (image.length < 33 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      image.readUInt32BE(16) !== 1920 || image.readUInt32BE(20) !== 1080 ||
      image.subarray(-12).toString('hex') !== '0000000049454e44ae426082') throw new Error('SCREENSHOT_INVALID_OR_INCOMPLETE')
}

export function sha256(filename) { return createHash('sha256').update(fs.readFileSync(filename)).digest('hex') }

export function snapshotSource(root) {
  const hashes = {}
  const visit = relative => {
    const target = requireSafePath(root, path.join(root, relative))
    const stat = fs.lstatSync(target)
    if (stat.isFile()) hashes[relative.replaceAll('\\', '/')] = sha256(target)
    else if (stat.isDirectory()) for (const name of fs.readdirSync(target).sort()) visit(path.join(relative, name))
  }
  for (const name of ['src', 'public', 'index.html', 'package-lock.json', 'vite.config.ts', 'scripts',
    'unity/ChangshanLongdan/Assets', 'unity/ChangshanLongdan/ProjectSettings', 'unity/ChangshanLongdan/Packages',
    'unity/ChangshanLongdan/.e02-project.json', 'unity/ChangshanLongdan/e02-package-policy.json',
    'docs/engineering/e02-unity.proposed.json', 'docs/engineering/E02_DECISION.md']) visit(name)
  return hashes
}
