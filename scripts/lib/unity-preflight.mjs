import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const protectedAssets = ['public/models/zhaoyun.glb', 'public/models/zhaoyun.manifest.json']
const supportedPackages = ['com.unity.render-pipelines.universal', 'com.unity.test-framework']

export function parseArguments(args) {
  const parsed = { mode: 'inventory' }
  const seen = new Set()
  const names = { '--mode': 'mode', '--editor': 'editorPath', '--out': 'output' }
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    if (!Object.hasOwn(names, flag)) throw new Error(`Unknown argument: ${flag}`)
    if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`)
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: ${flag}`)
    seen.add(flag)
    parsed[names[flag]] = args[i + 1]
  }
  if (!['inventory', 'preflight'].includes(parsed.mode)) throw new Error(`Unsupported mode: ${parsed.mode}`)
  return parsed
}

function contained(base, target) {
  const relative = path.relative(base, target)
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

// Inspect existing components without following a symlink/junction. Never creates a path.
function safeChild(root, target, io) {
  if (!contained(root, target)) return false
  const parts = path.relative(root, target).split(path.sep)
  let current = root
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i])
    let stat
    try {
      stat = io.lstat(current)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      return false
    }
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) return false
    try {
      if (!contained(root, io.realpath(current))) return false
    } catch {
      return false
    }
  }
  return true
}

function supportedContract(contract) {
  if (!contract || contract.schemaVersion !== 1 ||
      contract.projectRelativePath !== 'unity/ChangshanLongdan' ||
      contract.renderPipeline !== 'URP' || contract.buildTarget !== 'StandaloneWindows64' ||
      contract.scriptingBackend !== 'Mono' || contract.requiredPlaybackEngine !== 'windowsstandalonesupport' ||
      !/^\d+\.\d+\.\d+[abfp]\d+$/.test(contract.editorVersion) ||
      !/^[a-f0-9]{12}$/.test(contract.editorRevision)) return false
  const assets = contract.preservedAssets
  const packages = contract.packages
  return assets && packages &&
    Object.keys(assets).length === protectedAssets.length &&
    protectedAssets.every(name => /^[a-f0-9]{64}$/.test(assets[name])) &&
    Object.keys(packages).length === supportedPackages.length &&
    supportedPackages.every(name => /^\d+\.\d+\.\d+$/.test(packages[name]))
}

/** Read-only precheck. There is deliberately no Unity launch/build/test operation. */
export function inspectUnityPreflight(options, injected = {}) {
  const io = {
    exists: fs.existsSync,
    lstat: fs.lstatSync,
    realpath: fs.realpathSync,
    read: fs.readFileSync,
    readEditorVersion: () => { throw new Error('A read-only file-version provider is required') },
    ...injected,
  }
  const root = io.realpath(path.resolve(options.root))
  const contract = options.contract
  const report = {
    schemaVersion: 1,
    root,
    result: 'BLOCKED_PRECHECK',
    ready: false,
    decisionEvidence: 'DECLARED_RECORD_NOT_AUTHENTICATED_APPROVAL',
    engineExecutionSupported: false,
    unityProcessStarted: false,
    editor: { path: options.editorPath ?? null, productVersion: null },
    project: null,
    output: null,
    assets: {},
    blockers: [],
    engineEvidence: {
      compile: 'NOT_RUN', editMode: 'NOT_RUN', playMode: 'NOT_RUN',
      windowsBuild: 'NOT_RUN', playerLaunchClose: 'NOT_RUN', visibleScene: 'NOT_RUN', license: 'NOT_RUN',
    },
  }
  const reject = (code, message, classification = 'ENVIRONMENT_FAILURE') => {
    report.blockers.push({ code, message, classification })
  }
  if (!supportedContract(contract)) {
    reject('CONTRACT_UNSUPPORTED', 'Only the scoped URP/Windows64/Mono proposal and the two known asset paths are supported', 'TEST_FAILURE')
    if (contract?.projectRelativePath !== 'unity/ChangshanLongdan') {
      reject('PROJECT_PATH_INVALID', 'Project must be the isolated unity/ChangshanLongdan path', 'AUTHORIZATION_DENIAL')
    }
    return report
  }
  if (contract.decisionStatus !== 'ACCEPTED') {
    reject('ADR_NOT_ACCEPTED', 'E02 platform/pipeline decision is still proposed', 'AUTHORIZATION_DENIAL')
  }
  const decision = contract.acceptedDecisionRecord
  if (typeof decision !== 'string' || !decision) {
    reject('DECISION_RECORD_MISSING', 'An explicitly reviewed human decision record is still required', 'AUTHORIZATION_DENIAL')
  } else {
    const target = path.resolve(root, decision)
    const decisionRoot = path.join(root, 'docs', 'engineering')
    if (!contained(decisionRoot, target) || path.extname(target) !== '.md' || !safeChild(root, target, io)) {
      reject('DECISION_RECORD_PATH_INVALID', 'Decision record must be an in-checkout engineering Markdown file', 'AUTHORIZATION_DENIAL')
    } else if (!io.exists(target) || !io.lstat(target).isFile()) {
      reject('DECISION_RECORD_MISSING', 'The declared decision record does not exist', 'AUTHORIZATION_DENIAL')
    }
  }

  const editor = options.editorPath ? path.resolve(options.editorPath) : null
  report.editor.path = editor
  if (!editor || path.basename(editor).toLowerCase() !== 'unity.exe') {
    reject('EDITOR_PATH_INVALID', 'An explicit Unity.exe path is required')
  } else if (!io.exists(editor) || !io.lstat(editor).isFile() || io.lstat(editor).isSymbolicLink()) {
    reject('EDITOR_MISSING', 'Unity.exe is missing, not a file or a symlink')
  } else {
    try {
      report.editor.productVersion = io.readEditorVersion(editor)
      const expected = `${contract.editorVersion}_${contract.editorRevision}`
      if (report.editor.productVersion !== expected) {
        reject('EDITOR_VERSION_MISMATCH', `Expected ${expected}; actual ${report.editor.productVersion}`)
      }
    } catch (error) {
      reject('EDITOR_VERSION_PROBE_FAILED', String(error.message ?? error), 'TOOL_FAILURE')
    }
    const playback = path.join(path.dirname(editor), 'Data', 'PlaybackEngines', contract.requiredPlaybackEngine)
    if (!io.exists(playback) || !io.lstat(playback).isDirectory()) {
      reject('PLAYBACK_ENGINE_MISSING', 'Required Windows playback engine directory is absent')
    }
  }

  const project = path.resolve(root, contract.projectRelativePath)
  report.project = project
  if (!safeChild(root, project, io)) {
    reject('PROJECT_PATH_INVALID', 'Project crosses an untrusted link or checkout boundary', 'AUTHORIZATION_DENIAL')
  } else if (!io.exists(project) || !io.lstat(project).isDirectory()) {
    reject('PROJECT_MISSING', 'The isolated Unity project has not been created')
  } else {
    const versionFile = path.join(project, 'ProjectSettings', 'ProjectVersion.txt')
    if (!safeChild(root, versionFile, io) || !io.exists(versionFile) || !io.lstat(versionFile).isFile()) {
      reject('PROJECT_VERSION_MISSING', 'A safe ProjectVersion.txt is required')
    } else {
      const text = io.read(versionFile, 'utf8')
      const version = /^m_EditorVersion:\s*(\S+)\s*$/m.exec(text)?.[1]
      const revision = /^m_EditorVersionWithRevision:\s*(\S+)\s+\(([a-f0-9]{12})\)\s*$/m.exec(text)
      if (version !== contract.editorVersion || revision?.[1] !== contract.editorVersion || revision?.[2] !== contract.editorRevision) {
        reject('PROJECT_VERSION_MISMATCH', 'ProjectVersion.txt does not match the exact Editor version/revision')
      }
    }
    const manifestFile = path.join(project, 'Packages', 'manifest.json')
    try {
      if (!safeChild(root, manifestFile, io) || !io.exists(manifestFile) || !io.lstat(manifestFile).isFile()) {
        throw new Error('A safe Packages/manifest.json is required')
      }
      const manifest = JSON.parse(io.read(manifestFile, 'utf8'))
      for (const [name, expected] of Object.entries(contract.packages)) {
        if (manifest.dependencies?.[name] !== expected) {
          reject('PACKAGE_VERSION_MISMATCH', `${name} must be pinned to ${expected}`, 'TEST_FAILURE')
        }
      }
    } catch (error) {
      reject('PROJECT_MANIFEST_INVALID', String(error.message ?? error), 'TEST_FAILURE')
    }
    if (io.exists(path.join(project, 'Temp', 'UnityLockfile'))) {
      reject('PROJECT_POSSIBLY_IN_USE', 'UnityLockfile exists; no takeover or removal is allowed')
    }
  }

  const output = path.resolve(root, options.output ?? 'release/e02/engine-validation')
  report.output = output
  if (!contained(path.join(root, 'release', 'e02'), output) || !safeChild(root, output, io)) {
    reject('OUTPUT_PATH_INVALID', 'Output must be a new release/e02 child without links', 'AUTHORIZATION_DENIAL')
  } else if (io.exists(output)) {
    reject('OUTPUT_EXISTS', 'Existing output is preserved; select a new name', 'TEST_FAILURE')
  }
  for (const [asset, expected] of Object.entries(contract.preservedAssets)) {
    const target = path.join(root, asset)
    if (!safeChild(root, target, io) || !io.exists(target) || !io.lstat(target).isFile()) {
      reject('ASSET_MISSING', `Preserved source asset is unavailable: ${asset}`)
      continue
    }
    const actual = createHash('sha256').update(io.read(target)).digest('hex')
    report.assets[asset] = { expected, actual, matched: expected === actual }
    if (actual !== expected) reject('ASSET_HASH_MISMATCH', `Preserved source asset changed: ${asset}`, 'TEST_FAILURE')
  }
  report.ready = report.blockers.length === 0
  report.result = report.ready ? 'PRECHECK_ONLY' : 'BLOCKED_PRECHECK'
  return report
}
