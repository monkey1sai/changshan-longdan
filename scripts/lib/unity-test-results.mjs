import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { validateTestSummary } from './unity-execution.mjs'

export function readUnityTestResults(filename) {
  if (!fs.existsSync(filename) || fs.statSync(filename).size === 0) throw new Error('TEST_XML_MISSING')
  // Real XML parser; prohibit DTD and entity resolution. The path never enters shell source.
  const command = `$ErrorActionPreference='Stop'; $settings=[System.Xml.XmlReaderSettings]::new(); $settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit; $settings.XmlResolver=$null; $reader=[System.Xml.XmlReader]::Create($env:CHANGSHAN_E02_XML,$settings); try { $doc=[System.Xml.XmlDocument]::new(); $doc.XmlResolver=$null; $doc.Load($reader); $node=$doc.DocumentElement; if ($node.Name -ne 'test-run') { throw 'Expected NUnit test-run' }; foreach ($name in @('result','total','passed','failed','skipped','inconclusive')) { if (-not $node.HasAttribute($name)) { throw ('Missing NUnit attribute: '+$name) } }; $cases=@($doc.SelectNodes('//test-case')); $bad=@($cases | Where-Object { $_.GetAttribute('result') -ne 'Passed' }); [pscustomobject]@{result=$node.GetAttribute('result');total=[int]$node.GetAttribute('total');passed=[int]$node.GetAttribute('passed');failed=[int]$node.GetAttribute('failed');skipped=[int]$node.GetAttribute('skipped');inconclusive=[int]$node.GetAttribute('inconclusive');caseCount=$cases.Count;badCaseCount=$bad.Count;caseNames=@($cases | ForEach-Object { $_.GetAttribute('fullname') })} | ConvertTo-Json -Compress } finally { $reader.Dispose() }`
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, env: { ...process.env, CHANGSHAN_E02_XML: filename },
  })
  if (result.error || result.status !== 0) throw new Error(`TEST_XML_PARSE_FAILED: ${result.error?.message ?? result.stderr.trim()}`)
  return validateTestSummary(JSON.parse(result.stdout))
}
