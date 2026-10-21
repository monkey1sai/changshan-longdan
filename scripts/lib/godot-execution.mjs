import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { createZip } from '../zip.mjs'

const templateNames = ['version.txt', 'icudt_godot.dat', 'windows_debug_x86_64.exe', 'windows_debug_x86_64_console.exe',
  'windows_release_x86_64.exe', 'windows_release_x86_64_console.exe', 'web_nothreads_debug.zip', 'web_nothreads_release.zip']
const digest = data => createHash('sha256').update(data).digest('hex')
const hashFile = filename => digest(fs.readFileSync(filename))
const inside = (parent, child) => {
  const rel = path.relative(parent, child)
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`))
}

export function assertNoLinks(target) {
  target = path.resolve(target)
  const parsed = path.parse(target)
  let current = parsed.root
  for (const name of target.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, name)
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink()) throw new Error(`UNSAFE_PATH: ${current}`)
      if (current !== target && !stat.isDirectory()) throw new Error(`UNSAFE_PATH: non-directory ${current}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return target
}

export function claimOutput(output, repoRoot) {
  output = assertNoLinks(output)
  repoRoot = fs.realpathSync(repoRoot)
  if (inside(repoRoot, output)) throw new Error('OUTPUT_INSIDE_CHECKOUT')
  if (inside(output, repoRoot)) throw new Error('OUTPUT_CONTAINS_CHECKOUT')
  if (fs.existsSync(output)) throw new Error('OUTPUT_EXISTS')
  const parent = assertNoLinks(path.dirname(output))
  fs.mkdirSync(parent, { recursive: true })
  assertNoLinks(parent)
  fs.mkdirSync(output) // no recursive/exist_ok: concurrent claims must fail
  return output
}

export async function runProcess(executable, args, { timeoutMs = 60000, cwd, maxOutputBytes = 8 * 1024 * 1024 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1)
    throw new Error('INVALID_PROCESS_LIMITS')
  const started = Date.now()
  return new Promise(resolve => {
    let stdout = '', stderr = '', used = 0, timedOut = false, outputLimited = false, errorMessage = null
    const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME']
      .filter(key => process.env[key]).map(key => [key, process.env[key]]))
    const finish = (exitCode, signal) => {
      const finished = Date.now()
      resolve({ exitCode, signal, stdout, stderr, timedOut, outputLimited, error: errorMessage,
        startedAtMs: started, finishedAtMs: finished, durationMs: finished - started })
    }
    let child
    try {
      child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      errorMessage = `${error.code ?? 'SPAWN_ERROR'}: ${error.message}`
      finish(null, null)
      return
    }
    const collect = (data, channel) => {
      const available = Math.max(0, maxOutputBytes - used)
      const part = data.subarray(0, available).toString('utf8')
      if (channel === 'stdout') stdout += part
      else stderr += part
      used += Math.min(data.length, available)
      if (data.length > available) { outputLimited = true; child.kill('SIGKILL') }
    }
    child.stdout.on('data', data => collect(data, 'stdout'))
    child.stderr.on('data', data => collect(data, 'stderr'))
    child.on('error', error => { errorMessage = `${error.code ?? 'SPAWN_ERROR'}: ${error.message}` })
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, timeoutMs)
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer)
      finish(exitCode, signal)
    })
  })
}

function setting(text, section, key) {
  let current = ''
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) current = trimmed.slice(1, -1)
    else if (current === section && trimmed.startsWith(key + '=')) return trimmed.slice(key.length + 1).trim()
  }
  return null
}

export async function inspectGodot({ executable, project, templates, lockPath }) {
  const blockers = []
  const inventory = { schemaVersion: 1, ready: false, blockers, version: null, executableSha256: null, templateVersion: null,
    project: path.resolve(project), templates: path.resolve(templates), templateHashes: {}, renderer: null, versionProbe: null }
  let lock
  try {
    assertNoLinks(lockPath)
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    if (lock.schemaVersion !== 1 || lock.version !== '4.7.2.stable.official.ed1daf0bf' || lock.templateVersion !== '4.7.2.stable' ||
      !/^[0-9a-f]{64}$/.test(lock.executableSha256) || Object.keys(lock.templates ?? {}).length !== templateNames.length ||
      templateNames.some(name => !/^[0-9a-f]{64}$/.test(lock.templates[name]))) throw new Error('lock shape')
  } catch { blockers.push('LOCK_INVALID'); lock = null }
  try {
    assertNoLinks(executable)
    if (!fs.statSync(executable).isFile()) throw new Error('missing')
    inventory.executableSha256 = hashFile(executable)
    if (lock && inventory.executableSha256 !== lock.executableSha256) blockers.push('EXECUTABLE_HASH_MISMATCH')
  } catch { blockers.push('EXECUTABLE_MISSING') }
  try {
    assertNoLinks(project)
    const config = fs.readFileSync(path.join(project, 'project.godot'), 'utf8')
    const presets = fs.readFileSync(path.join(project, 'export_presets.cfg'), 'utf8')
    inventory.renderer = setting(config, 'rendering', 'renderer/rendering_method')
    if (inventory.renderer !== '"gl_compatibility"') blockers.push('RENDERER_MISMATCH')
    inventory.mainScene = JSON.parse(setting(config, 'application', 'run/main_scene') ?? 'null')
    if (!['res://scenes/bootstrap.tscn', 'res://scenes/game.tscn'].includes(inventory.mainScene)) blockers.push('MAIN_SCENE_MISMATCH')
    if (inventory.mainScene === 'res://scenes/game.tscn' && ['preset.0', 'preset.1'].some(p => {
      const filters = JSON.parse(setting(presets, p, 'include_filter') ?? '""').split(',').map(value => value.trim())
      return !filters.includes('data/*.json') || !filters.includes('build_identity.json')
    })) blockers.push('RUNTIME_JSON_NOT_EXPORTED')
    if (setting(presets, 'preset.0', 'platform') !== '"Windows Desktop"' || setting(presets, 'preset.1', 'platform') !== '"Web"' ||
      setting(presets, 'preset.0.options', 'binary_format/architecture') !== '"x86_64"' ||
      setting(presets, 'preset.1.options', 'variant/thread_support') !== 'false') blockers.push('EXPORT_PRESET_MISMATCH')
  } catch { blockers.push('PROJECT_MISSING') }
  try {
    assertNoLinks(templates)
    inventory.templateVersion = fs.readFileSync(path.join(templates, 'version.txt'), 'utf8').trim()
    if (lock && inventory.templateVersion !== lock.templateVersion) blockers.push('TEMPLATE_VERSION_MISMATCH')
  } catch { blockers.push('TEMPLATE_VERSION_MISSING') }
  if (lock) for (const name of templateNames) {
    const file = path.join(templates, name)
    try {
      assertNoLinks(file)
      inventory.templateHashes[name] = hashFile(file)
      if (inventory.templateHashes[name] !== lock.templates[name]) blockers.push(`TEMPLATE_HASH_MISMATCH:${name}`)
    } catch { blockers.push(`TEMPLATE_MISSING:${name}`) }
  }
  if (blockers.length === 0) {
    const result = await runProcess(executable, ['--version'], { timeoutMs: 10000 })
    inventory.versionProbe = result
    inventory.version = result.stdout.trim()
    if (result.exitCode !== 0 || result.timedOut || result.outputLimited || result.error) blockers.push('VERSION_PROBE_FAILED')
    if (inventory.version !== lock.version) blockers.push('VERSION_MISMATCH')
  }
  inventory.ready = blockers.length === 0
  return inventory
}

export function readGodotReport(filename, context) {
  if (!fs.existsSync(filename)) throw new Error('TEST_REPORT_MISSING')
  try {
    assertNoLinks(filename)
    const r = JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (r.schemaVersion !== 1 || r.runId !== context.runId || r.candidate !== context.candidate ||
      !Number.isFinite(r.startedAtMs) || !Number.isFinite(r.finishedAtMs) || r.startedAtMs < context.startedAtMs ||
      r.finishedAtMs > context.finishedAtMs || r.finishedAtMs < r.startedAtMs ||
      !Number.isInteger(r.total) || r.total < 1 || r.passed !== r.total || r.failed !== 0 || r.skipped !== 0 ||
      !Array.isArray(r.cases) || r.cases.length !== r.total || r.cases.some(c => c.pass !== true || typeof c.name !== 'string' || !c.name) ||
      new Set(r.cases.map(c => c.name)).size !== r.total) throw new Error('shape/identity/time/cases')
    return r
  } catch (error) { throw new Error(`INVALID_TEST_REPORT: ${error.message}`) }
}

function tree(directory, { skipImportCache = false } = {}) {
  assertNoLinks(directory)
  const files = []
  const visit = (dir, relative = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (skipImportCache && entry.name === '.godot') continue
      const filename = path.join(dir, entry.name), rel = relative ? `${relative}/${entry.name}` : entry.name
      assertNoLinks(filename)
      if (entry.isDirectory()) visit(filename, rel)
      else if (entry.isFile()) files.push({ path: rel, bytes: fs.statSync(filename).size, sha256: hashFile(filename) })
      else throw new Error('UNSAFE_PATH: non-regular member')
    }
  }
  visit(directory)
  return files
}

export function payloadManifest(directory) {
  const files = tree(directory)
  if (files.length === 0) throw new Error('EMPTY_PAYLOAD')
  return { files, treeSha256: digest(JSON.stringify(files)) }
}
export function verifyPayload(directory, expected) {
  if (JSON.stringify(payloadManifest(directory)) !== JSON.stringify(expected)) throw new Error('PAYLOAD_MISMATCH')
  return true
}

export function packagePayload(directory, filename) {
  assertNoLinks(filename)
  if (fs.existsSync(filename)) throw new Error('OUTPUT_EXISTS')
  const manifest = payloadManifest(directory)
  const archive = createZip(manifest.files.map(file => ({ name: file.path, data: fs.readFileSync(path.join(directory, file.path)) })))
  fs.writeFileSync(filename, archive, { flag: 'wx' })
  verifyPayload(directory, manifest)
  return { file: path.basename(filename), bytes: archive.length, sha256: digest(archive) }
}

function copyProject(project, staging) {
  const source = tree(project, { skipImportCache: true })
  fs.mkdirSync(staging)
  for (const file of source) {
    const target = path.join(staging, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(project, file.path), target)
    if (hashFile(target) !== file.sha256) throw new Error('STAGED_SOURCE_MISMATCH')
  }
  return source
}

function pinnedPresets(staging, templates) {
  const file = path.join(staging, 'export_presets.cfg')
  let text = fs.readFileSync(file, 'utf8')
  const replaceInSection = (section, key, value) => {
    const lines = text.split('\n'); let current = ''; let count = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('[')) current = lines[i].trim().slice(1, -1)
      if (current === section && lines[i].startsWith(key + '=')) { lines[i] = `${key}=${JSON.stringify(value.replaceAll('\\', '/'))}`; count++ }
    }
    if (count !== 1) throw new Error('CUSTOM_TEMPLATE_SLOT_MISSING')
    text = lines.join('\n')
  }
  for (const [preset, prefix, suffix] of [['preset.0.options', 'windows', '_x86_64.exe'], ['preset.1.options', 'web_nothreads', '.zip']]) {
    for (const mode of ['debug', 'release']) replaceInSection(preset, `custom_template/${mode}`, path.join(templates, `${prefix}_${mode}${suffix}`))
  }
  fs.writeFileSync(file, text)
}

export async function validateGodot({ mode, executable, project, templates, lockPath, output, timeoutMs = 120000 }) {
  if (!['inventory', 'tests', 'export'].includes(mode)) throw new Error('INVALID_MODE')
  project = path.resolve(project); templates = path.resolve(templates); executable = path.resolve(executable); lockPath = path.resolve(lockPath)
  const repoRoot = execFileSync('git', ['-C', project, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const candidate = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const checkoutStatus = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' })
  output = claimOutput(output, repoRoot)
  const run = { schemaVersion: 1, runId: randomUUID(), candidate, checkoutStatus, mode, status: 'FAIL',
    startedAt: new Date().toISOString(), steps: [], testSummary: null, payloads: {}, sourceFiles: [],
    limitation: 'Headless import/rule/export checks only; not visible gameplay, final assets/audio, physical controller/performance, migration-complete, or natural Jev victory evidence' }
  const save = () => fs.writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2) + '\n')
  save()
  try {
    run.inventory = await inspectGodot({ executable, project, templates, lockPath })
    run.toolchainLockSha256 = hashFile(lockPath)
    if (!run.inventory.ready) { run.status = 'BLOCKED'; throw new Error(run.inventory.blockers.join('; ')) }
    const initialSource = tree(project, { skipImportCache: true })
    run.sourceFiles = initialSource
    if (mode !== 'inventory') {
      const staging = path.join(output, 'staged-project')
      copyProject(project, staging)
      pinnedPresets(staging, templates)
      fs.writeFileSync(path.join(staging, 'build_identity.json'), JSON.stringify({ schemaVersion: 1, candidate, runId: run.runId,
        sourceTreeSha256: digest(JSON.stringify(initialSource)), toolchainLockSha256: run.toolchainLockSha256 }) + '\n')
      run.effectivePresetsSha256 = hashFile(path.join(staging, 'export_presets.cfg'))
      const step = async (name, args) => {
        const result = await runProcess(executable, args, { timeoutMs, cwd: staging })
        fs.writeFileSync(path.join(output, name + '.stdout.log'), result.stdout)
        fs.writeFileSync(path.join(output, name + '.stderr.log'), result.stderr)
        run.steps.push({ name, args, ...result }); save()
        if (result.exitCode !== 0 || result.timedOut || result.outputLimited || result.error || /SCRIPT ERROR:|Parse Error:|^ERROR:/m.test(result.stdout + '\n' + result.stderr))
          throw new Error(`STEP_FAILED:${name}`)
        return result
      }
      await step('import', ['--headless', '--editor', '--path', staging, '--import', '--quit'])
      const reportFile = path.join(output, 'godot-tests.json')
      const result = await step('tests', ['--headless', '--path', staging, '--script', 'res://tests/smoke.gd', '--',
        '--report', reportFile, '--run-id', run.runId, '--candidate', candidate])
      run.testSummary = readGodotReport(reportFile, { ...result, runId: run.runId, candidate })
      if (mode === 'export') {
        const windows = path.join(output, 'windows'), web = path.join(output, 'web')
        fs.mkdirSync(windows); fs.mkdirSync(web)
        await step('export-windows', ['--headless', '--path', staging, '--export-release', 'Windows Desktop', path.join(windows, 'ChangshanLongdan.exe')])
        await step('export-web', ['--headless', '--path', staging, '--export-release', 'Web', path.join(web, 'index.html')])
        if (!fs.existsSync(path.join(windows, 'ChangshanLongdan.exe')) || !fs.existsSync(path.join(windows, 'ChangshanLongdan.pck')) ||
          !fs.existsSync(path.join(web, 'index.html')) || !fs.existsSync(path.join(web, 'index.wasm'))) throw new Error('EXPORT_PAYLOAD_MISSING')
        run.payloads = { windows: payloadManifest(windows), web: payloadManifest(web) }
        run.archives = { windows: packagePayload(windows, path.join(output, 'windows.zip')), web: packagePayload(web, path.join(output, 'web.zip')) }
      }
    }
    if (JSON.stringify(initialSource) !== JSON.stringify(tree(project, { skipImportCache: true }))) throw new Error('SOURCE_CHANGED_DURING_RUN')
    // Re-read hashed templates/executable after export as well: a concurrent replacement invalidates the run.
    const after = await inspectGodot({ executable, project, templates, lockPath })
    run.postflightInventory = after
    save()
    if (!after.ready || hashFile(lockPath) !== run.toolchainLockSha256 || after.executableSha256 !== run.inventory.executableSha256 || JSON.stringify(after.templateHashes) !== JSON.stringify(run.inventory.templateHashes))
      throw new Error('TOOLCHAIN_CHANGED_DURING_RUN')
    run.status = 'PASS'
  } catch (error) { run.error = error.message }
  run.finishedAt = new Date().toISOString(); save()
  return run
}
