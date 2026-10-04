import { spawnSync } from 'node:child_process'

// PE metadata only: this never launches the Editor or reads licensing files.
export function readEditorVersion(editorPath) {
  if (process.platform !== 'win32') throw new Error('Windows PE file-version probe requires Windows')
  const command = '$ErrorActionPreference = "Stop"; $item = Get-Item -LiteralPath $env:CHANGSHAN_UNITY_PROBE_PATH; $item.VersionInfo.ProductVersion'
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    shell: false, windowsHide: true, timeout: 15000, encoding: 'utf8',
    env: { ...process.env, CHANGSHAN_UNITY_PROBE_PATH: editorPath },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`File-version probe exit ${result.status}: ${result.stderr.trim()}`)
  return result.stdout.trim()
}
