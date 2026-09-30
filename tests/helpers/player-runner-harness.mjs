import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import * as path from 'node:path'
import * as url from 'node:url'
import * as core from '../../src/testing/player-loop.ts'

// Execute the unchanged CLI runner with deterministic boundary dependencies.
// No real browser, network, credentials or filesystem writes are available.
let input = ''
for await (const chunk of process.stdin) input += chunk
const fixture = JSON.parse(input)
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..')
const runnerPath = path.join(root, 'scripts/jev-player-loop.mjs')
const source = await readFile(runnerPath, 'utf8')
const readable = new Set([
  runnerPath, ...['scripts/lib/player-ui.mjs', 'src/testing/player-loop.ts', 'index.html',
    'src/game.ts', 'src/entities/player.ts', 'src/entities/enemies.ts'].map(file => path.join(root, file)),
])
let clock = 0, observation = fixture.initial, report, modelCalls = 0
const executed = [], traces = []
const page = {
  setDefaultTimeout() {}, on() {}, goto: async () => {}, bringToFront: async () => {},
  locator: () => ({ waitFor: async () => {} }),
  screenshot: async ({ path: file }) => {
    if (path.basename(file).startsWith('stage-')) clock += fixture.stageScreenshotMs ?? 0
  },
}
const fakeProcess = {
  argv: ['node', runnerPath, '--live', '--scenario=review-fixture.json'],
  env: { TYPESAFE_API_KEY: 'NON_SECRET_TEST_SENTINEL' }, exitCode: 0,
  exit: code => { throw new Error('Unexpected process exit ' + code) },
}
const context = vm.createContext({
  console: { log() {} }, process: fakeProcess, performance: { now: () => clock },
  Date, Map, Set, JSON, Number, String, Error, AbortSignal,
  fetch: async (_endpoint, init) => {
    modelCalls++
    clock += fixture.modelMs ?? 0
    const request = JSON.parse(init.body)
    const choices = Object.keys(request.questions.next_action.criteria)
    const choice = fixture.actions[executed.length]?.id
    if (!choices.includes(choice)) throw new Error('Fixture action was not offered')
    return { ok: true, json: async () => ({
      model: request.model, usage: { input_tokens: 1, output_tokens: 1 },
      answers: { next_action: { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(choices.map(id => [id, id === choice ? 1 : 0])) } },
    }) }
  },
})
const mocks = {
  'node:fs/promises': {
    mkdir: async () => {},
    readFile: async file => {
      if (file === path.join(root, 'review-fixture.json')) return JSON.stringify(fixture.scenario)
      if (!readable.has(file)) throw new Error('Unexpected fixture file read')
      return readFile(file)
    },
    writeFile: async (file, data) => {
      if (path.basename(file) === 'report.json') report = JSON.parse(data)
    },
    appendFile: async (_file, data) => { traces.push(JSON.parse(data)) },
  },
  'node:crypto': { createHash }, 'node:path': path, 'node:url': url,
  vite: { createServer: async () => ({
    listen: async () => {}, httpServer: { address: () => ({ port: 1 }) }, close: async () => {},
  }) },
  './lib/player-ui.mjs': {
    observe: async () => structuredClone(observation),
    readTitleHints: async () => 'WASD J K F Esc L',
    execute: async (_page, action) => {
      const next = fixture.actions[executed.length]
      if (!next || next.id !== action.id) throw new Error('Unexpected fixture action')
      executed.push(action.id)
      clock += next.elapsedMs ?? action.holdMs + action.settleMs
      observation = structuredClone(next.after)
    },
  },
  '../src/testing/player-loop.ts': core,
  playwright: { chromium: { launch: async () => ({
    version: () => 'MOCK', newPage: async () => page, close: async () => {},
  }) } },
}
const modules = new Map()
async function getModule(specifier) {
  if (modules.has(specifier)) return modules.get(specifier)
  const exports = mocks[specifier]
  if (!exports) throw new Error('Unexpected fixture import ' + specifier)
  const module = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context })
  modules.set(specifier, module)
  await module.link(() => { throw new Error('Unexpected nested fixture import') })
  await module.evaluate()
  return module
}
const runner = new vm.SourceTextModule(source, {
  context,
  initializeImportMeta(meta) { meta.url = url.pathToFileURL(runnerPath).href },
  importModuleDynamically: getModule,
})
await runner.link(getModule)
await runner.evaluate()
console.log(JSON.stringify({ report, executed, traces, modelCalls, exitCode: fakeProcess.exitCode }))
