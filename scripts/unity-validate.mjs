import { spawn, spawnSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectUnityPreflight } from './lib/unity-preflight.mjs'
import { readEditorVersion } from './lib/unity-editor-version.mjs'
import { requireSafePath, requireSafeEngineWrites, validateExecutionScope, validatePackagePolicy, validateImmutableSource, validateFrozenSource, validatePackageLock,
  validateSettings, validateRuntime, sha256, snapshotSource } from './lib/unity-execution.mjs'
import { readUnityTestResults } from './lib/unity-test-results.mjs'

const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)))
const defaultEditor = 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.6.4f1\\Editor\\Unity.exe'
const args = process.argv.slice(2)
const options = {}
const names = { '--editor': 'editor', '--out': 'out' }
let run, lease, lockPath, output
const readJson = filename => JSON.parse(fs.readFileSync(requireSafePath(root, filename), 'utf8'))
const writeJson = (filename, data) => fs.writeFileSync(requireSafePath(root, filename), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })

async function fixedOfficialArchives(policy) {
  const directory = requireSafePath(root, path.join(output, 'official-packages'))
  fs.mkdirSync(directory)
  const evidence = {}
  for (const [name, expected] of Object.entries(policy.packages)) {
    if (expected.source !== 'registry') continue
    const url = `https://download.packages.unity.com/${name}/-/${name}-${expected.version}.tgz`
    const filename = requireSafePath(root, path.join(directory, name + '-' + expected.version + '.tgz'))
    const cached = requireSafePath(root, path.join(root, 'release/e02/official-package-cache', name + '-' + expected.version + '.tgz'))
    const cacheHit = fs.existsSync(cached)
    const expectedCdn = `https://cdn.packages.unity.com/tarballs/${name}/${expected.version}/${expected.sha1}.tgz`
    // Only follow the exact checksum-addressed Unity CDN destination supplied by the official host.
    const download = cacheHit ? null : spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference="Stop"; $request=[System.Net.HttpWebRequest]::Create($env:CHANGSHAN_E02_PACKAGE_URL); $request.AllowAutoRedirect=$false; $request.Timeout=15000; $response=$request.GetResponse(); try { $status=[int]$response.StatusCode; $location=$response.Headers["Location"] } finally { $response.Close() }; if ($status -ne 302 -or $location -cne $env:CHANGSHAN_E02_PACKAGE_CDN) { throw "Unexpected official package redirect" }; Invoke-WebRequest -UseBasicParsing -Uri $env:CHANGSHAN_E02_PACKAGE_CDN -OutFile $env:CHANGSHAN_E02_PACKAGE_OUT -MaximumRedirection 0 -TimeoutSec 30'], {
      shell: false, windowsHide: true, encoding: 'utf8', timeout: 45000,
      env: { ...process.env, CHANGSHAN_E02_PACKAGE_URL: url, CHANGSHAN_E02_PACKAGE_OUT: filename, CHANGSHAN_E02_PACKAGE_CDN: expectedCdn },
    })
    if (cacheHit) fs.copyFileSync(cached, filename, fs.constants.COPYFILE_EXCL)
    else if (download.error || download.status !== 0) throw new Error(`OFFICIAL_PACKAGE_DOWNLOAD_FAILED: ${name}; ${download.error?.message ?? download.stderr.trim()}`)
    if (fs.statSync(filename).size > 64000000) throw new Error(`OFFICIAL_PACKAGE_TOO_LARGE: ${name}`)
    const bytes = fs.readFileSync(filename)
    const actual = createHash('sha1').update(bytes).digest('hex')
    if (bytes.length > 64000000 || actual !== expected.sha1) throw new Error(`OFFICIAL_PACKAGE_CHECKSUM_MISMATCH: ${name}`)
    const manifest = spawnSync('tar.exe', ['-xOf', filename, 'package/package.json'], { shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000 })
    if (manifest.error || manifest.status !== 0) throw new Error(`OFFICIAL_PACKAGE_MANIFEST_FAILED: ${name}`)
    const packageJson = JSON.parse(manifest.stdout)
    if (packageJson.name !== name || packageJson.version !== expected.version) throw new Error(`OFFICIAL_PACKAGE_VERSION_MISMATCH: ${name}`)
    if (!cacheHit) {
      requireSafePath(root, cached)
      fs.mkdirSync(path.dirname(cached), { recursive: true })
      fs.copyFileSync(filename, cached, fs.constants.COPYFILE_EXCL)
    }
    evidence[name] = { url, verifiedCdn: expectedCdn, cacheHit, version: expected.version, bytes: bytes.length, sha1: actual, sha256: sha256(filename),
      manifestSha256: createHash('sha256').update(manifest.stdout).digest('hex'), filename }
  }
  writeJson(path.join(directory, 'provenance.json'), evidence)
  return evidence
}

function validateResolvedPackages(report, policy, builtIn, archives) {
  for (const item of report.packages) {
    const expected = policy.packages[item.name]
    const boundary = expected.source === 'builtin' ? builtIn : path.join(run.project, 'Library/PackageCache')
    const resolved = requireSafePath(boundary, item.resolvedPath)
    if (expected.source === 'builtin' && resolved !== path.join(builtIn, item.name)) throw new Error(`PACKAGE_RESOLVED_PATH_MISMATCH: ${item.name}`)
    const filename = requireSafePath(boundary, path.join(resolved, 'package.json'))
    const actual = JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (actual.name !== item.name || actual.version !== expected.version) throw new Error(`PACKAGE_RESOLVED_VERSION_MISMATCH: ${item.name}`)
    if (expected.source === 'registry' && sha256(filename) !== archives[item.name].manifestSha256)
      throw new Error(`PACKAGE_RESOLVED_MANIFEST_MISMATCH: ${item.name}`)
  }
}

async function processStage(name, executable, argv, cwd, env, visible = false) {
  const stagePath = requireSafePath(root, path.join(output, name))
  fs.mkdirSync(stagePath)
  const start = new Date().toISOString()
  const record = { name, executable, argv, cwd, start, timeoutMs: visible ? 120000 : 900000, runId: run.runId, verified: false }
  writeJson(path.join(stagePath, 'command.json'), record)
  const stdout = fs.openSync(path.join(stagePath, 'stdout.log'), 'wx')
  const stderr = fs.openSync(path.join(stagePath, 'stderr.log'), 'wx')
  let child
  let timedOut = false
  try {
    child = spawn(executable, argv, { shell: false, windowsHide: !visible, cwd, env, stdio: ['ignore', stdout, stderr] })
    record.pid = child.pid ?? null
    writeJson(path.join(stagePath, 'started.json'), { pid: record.pid, runnerPid: process.pid, runId: run.runId, executable, argv, cwd })
    const timer = setTimeout(() => {
      // This handle belongs exclusively to this launch. Never kill all Unity processes.
      timedOut = true
      child.kill()
    }, record.timeoutMs)
    const monitor = setInterval(() => {
      const logfile = path.join(stagePath, visible ? 'Player.log' : 'Editor.log')
      try {
        if (!fs.existsSync(logfile)) return
        const log = fs.readFileSync(logfile, 'utf8')
        if (/Failed to acquire global mutex Unity-LicenseClient-/.test(log)) {
          record.terminationReason = 'ENVIRONMENT_FAILURE: shared Unity Licensing Client mutex/IPC unavailable'
          child.kill() // Only this launch handle; never stop the shared client or another Editor.
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          record.terminationReason = `TOOL_FAILURE: stage log monitor ${error.code ?? 'read error'}`
          child.kill()
        }
      }
    }, 2000)
    const exit = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    }).finally(() => { clearTimeout(timer); clearInterval(monitor) })
    Object.assign(record, { pid: child.pid, end: new Date().toISOString(), timedOut, ...exit })
    writeJson(path.join(stagePath, 'exit.json'), record)
    run.stages.push(record)
    if (record.terminationReason) throw new Error(record.terminationReason)
    if (timedOut || exit.code !== 0) throw new Error(`STAGE_FAILED: ${name}; exit=${exit.code}; timedOut=${timedOut}`)
  } finally { fs.closeSync(stdout); fs.closeSync(stderr) }
  return stagePath
}

try {
  if (args.length % 2) throw new Error('Arguments require name/value pairs')
  for (let i = 0; i < args.length; i += 2) {
    const key = names[args[i]]
    if (!key || options[key] || !args[i + 1]) throw new Error(`Invalid or duplicate argument: ${args[i]}`)
    options[key] = args[i + 1]
  }
  if (!options.out) throw new Error('Explicit fresh --out release/e02/<run> required')
  if (process.platform !== 'win32') throw new Error('Windows-only E02 target')
  const contract = readJson(path.join(root, 'docs/engineering/e02-unity.proposed.json'))
  const project = requireSafePath(root, path.join(root, contract.projectRelativePath))
  const manifest = readJson(path.join(project, 'Packages/manifest.json'))
  validateExecutionScope(contract, manifest)
  const marker = readJson(path.join(project, '.e02-project.json'))
  if (marker.task !== 'E02' || marker.projectRelativePath !== contract.projectRelativePath || marker.decisionRecord !== contract.acceptedDecisionRecord)
    throw new Error('PROJECT_MARKER_INVALID')
  const editor = path.resolve(options.editor ?? defaultEditor)
  const preflight = inspectUnityPreflight({ root, contract, editorPath: editor, output: options.out }, { readEditorVersion })
  if (!preflight.ready) {
    process.stdout.write(JSON.stringify(preflight, null, 2) + '\n')
    process.exitCode = 2
  } else {
    const policy = readJson(path.join(project, 'e02-package-policy.json'))
    validatePackagePolicy(policy)
    const cache = requireSafePath(root, path.join(root, 'release/e02/upm-cache'))
    requireSafeEngineWrites(root, project, cache)
    const builtIn = path.join(path.dirname(editor), 'Data/Resources/PackageManager/BuiltInPackages')
    const packageEvidence = []
    for (const [name, expected] of Object.entries(policy.packages)) {
      if (expected.source !== 'builtin') continue
      const filename = path.join(builtIn, name, 'package.json')
      const actual = JSON.parse(fs.readFileSync(filename, 'utf8'))
      if (actual.name !== name || actual.version !== expected.version) throw new Error(`BUILTIN_PACKAGE_MISMATCH: ${name}`)
      packageEvidence.push({ name, version: actual.version, filename, manifestSha256: sha256(filename), dependencies: actual.dependencies ?? {} })
    }
    const packageLock = path.join(project, 'Packages/packages-lock.json')
    if (fs.existsSync(packageLock)) validatePackageLock(readJson(packageLock), policy)
    lockPath = requireSafePath(root, path.join(project, '.e02-runner.lock'))
    lease = fs.openSync(lockPath, 'wx')
    fs.writeFileSync(lease, JSON.stringify({ pid: process.pid, runId: 'starting', project }))
    // Repeat checks after the exclusive lease, immediately before engine execution.
    if (fs.existsSync(path.join(project, 'Temp/UnityLockfile'))) throw new Error('PROJECT_POSSIBLY_IN_USE')
    requireSafePath(root, project)
    output = requireSafePath(root, path.resolve(root, options.out))
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.mkdirSync(output)
    const runId = randomUUID()
    run = { schemaVersion: 1, runId, sourceHead: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false }).stdout.trim(),
      sourceBefore: snapshotSource(root), editor, editorSha256: sha256(editor), project, output, preflight,
      packageEvidence, result: 'RUNNING', stages: [], start: new Date().toISOString(),
      authorizationRecord: contract.acceptedDecisionRecord, humanPlay: 'NOT_RUN', performanceAcceptance: 'NOT_RUN' }
    writeJson(path.join(output, 'start.json'), run)
    run.officialArchives = await fixedOfficialArchives(policy)
    const env = { ...process.env, UPM_CACHE_ROOT: cache }
    requireSafePath(root, env.UPM_CACHE_ROOT)
    const common = ['-batchmode', '-projectPath', project, '-buildTarget', 'StandaloneWindows64', '-force-d3d11', '-e02RunId', runId]
    let frozenSource
    for (const stage of ['compile', 'editmode', 'playmode', 'build']) {
      const stagePath = path.join(output, stage)
      requireSafePath(root, stagePath)
      requireSafeEngineWrites(root, project, cache)
      if (frozenSource) validateFrozenSource(frozenSource, snapshotSource(root))
      if (fs.existsSync(path.join(project, 'Temp/UnityLockfile'))) throw new Error('PROJECT_POSSIBLY_IN_USE')
      const argv = [...common, '-logFile', path.join(stagePath, 'Editor.log'), '-e02Output', stagePath]
      if (stage === 'compile' || stage === 'build') argv.push('-quit', '-executeMethod',
        stage === 'compile' ? 'Changshan.Foundation.Editor.FoundationBuild.Configure' : 'Changshan.Foundation.Editor.FoundationBuild.BuildWindows')
      else argv.push('-runTests', '-testPlatform', stage === 'editmode' ? 'EditMode' : 'PlayMode',
        '-assemblyNames', stage === 'editmode' ? 'Changshan.Foundation.EditTests' : 'Changshan.Foundation.PlayTests',
        '-testResults', path.join(stagePath, 'tests.xml'))
      await processStage(stage, editor, argv, project, env)
      validatePackageLock(readJson(packageLock), policy)
      if (stage === 'compile' || stage === 'build') {
        const report = readJson(path.join(stagePath, stage + '.json'))
        validateSettings(report, runId, project, stage, policy)
        validateResolvedPackages(report, policy, builtIn, run.officialArchives)
      }
      else {
        const summary = readUnityTestResults(requireSafePath(root, path.join(stagePath, 'tests.xml')))
        const expectedCount = stage === 'editmode' ? 9 : 1
        const className = stage === 'editmode' ? 'FoundationEditTests' : 'FoundationPlayTests'
        if (summary.total !== expectedCount || !Array.isArray(summary.caseNames) || new Set(summary.caseNames).size !== expectedCount ||
            summary.caseNames.some(name => !name.startsWith('Changshan.Foundation.Tests.' + className + '.')))
          throw new Error(`TEST_SET_INCOMPLETE: ${stage}`)
        writeJson(path.join(stagePath, 'test-summary.json'), summary)
      }
      const log = fs.readFileSync(path.join(stagePath, 'Editor.log'), 'utf8')
      if (/error CS\d{4}|Scripts have compiler errors|Aborting batchmode due to failure|Exception:|Assertion failed/i.test(log))
        throw new Error(`EDITOR_LOG_ERROR: ${stage}`)
      run.stages.at(-1).sourceAfter = snapshotSource(root)
      validateImmutableSource(run.sourceBefore, run.stages.at(-1).sourceAfter)
      if (stage === 'compile') frozenSource = run.stages.at(-1).sourceAfter
      else validateFrozenSource(frozenSource, run.stages.at(-1).sourceAfter)
      run.stages.at(-1).verified = true
    }
    const player = requireSafePath(root, path.join(output, 'build/player/ChangshanLongdan.exe'))
    if (!fs.existsSync(player) || fs.statSync(player).size === 0) throw new Error('PLAYER_MISSING')
    run.playerSha256 = sha256(player)
    const runtimePath = path.join(output, 'player')
    await processStage('player', player, ['-screen-fullscreen', '0', '-screen-width', '1920', '-screen-height', '1080',
      '-force-d3d11', '-logFile', path.join(runtimePath, 'Player.log'), '-e02RunId', runId, '-e02Output', runtimePath],
    path.dirname(player), env, true)
    validateRuntime(readJson(path.join(runtimePath, 'runtime.json')), runId, path.join(runtimePath, 'scene.png'))
    run.screenshotSha256 = sha256(path.join(runtimePath, 'scene.png'))
    run.sourceAfter = snapshotSource(root)
    validateImmutableSource(run.sourceBefore, run.sourceAfter)
    validateFrozenSource(frozenSource, run.sourceAfter)
    run.stages.at(-1).verified = true
    run.result = 'PASS_LOCAL_ENGINE_FOUNDATION'
    run.end = new Date().toISOString()
    writeJson(path.join(output, 'result.json'), run)
    process.stdout.write(JSON.stringify({ result: run.result, runId, output, stages: run.stages.map(item => ({ name: item.name, code: item.code, verified: item.verified })) }, null, 2) + '\n')
  }
} catch (error) {
  const message = String(error.message ?? error)
  if (run && output) {
    run.result = 'BLOCKED'
    run.error = message
    run.end = new Date().toISOString()
    writeJson(path.join(output, 'result.json'), run)
  }
  process.stderr.write(JSON.stringify({ result: 'BLOCKED', error: message, output: output ?? null, unityProcessStarted: (run?.stages.length ?? 0) > 0 }) + '\n')
  process.exitCode = 2
} finally {
  if (lease !== undefined) {
    fs.closeSync(lease)
    requireSafePath(root, lockPath)
    fs.unlinkSync(lockPath) // Only the lease file created by this process, never UnityLockfile.
  }
}
