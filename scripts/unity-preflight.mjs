import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectUnityPreflight, parseArguments } from './lib/unity-preflight.mjs'
import { readEditorVersion } from './lib/unity-editor-version.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

try {
  const args = parseArguments(process.argv.slice(2))
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'docs/engineering/e02-unity.proposed.json'), 'utf8'))
  const editorPath = args.editorPath ?? 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.6.4f1\\Editor\\Unity.exe'
  const report = inspectUnityPreflight({ root, contract, editorPath, output: args.output }, { readEditorVersion })
  report.mode = args.mode
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  // Inventory successfully observes blockers. A requested readiness check exits 2 on blockers.
  process.exitCode = args.mode === 'preflight' && !report.ready ? 2 : 0
} catch (error) {
  process.stderr.write(`${JSON.stringify({ result: 'TOOL_FAILURE', unityProcessStarted: false, error: String(error.message ?? error) })}\n`)
  process.exitCode = 1
}
