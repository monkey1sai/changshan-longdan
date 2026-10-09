import test from 'node:test'
import assert from 'node:assert/strict'
import { clockWindowVerdict } from '../lib/e12-clock-contract.mjs'
import { utcTicks } from '../lib/e12-performance.mjs'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const expected = { pid: 42, processStartUtc: '2026-10-10T00:00:00Z', imageSha256: 'a'.repeat(64),
  runId: 'run', fingerprintSha256: 'b'.repeat(64), timezoneId: 'Taipei Standard Time' }
function fixture() {
  const sample = { apiStatus: 0, cStatus: 0, counterType: 65792, frequency: '10000000',
    utcOffsetTicks: '288000000000', rawTimestamp: (utcTicks('2026-10-10T00:00:10.1Z') + 116444736000000000n + 288000000000n).toString(),
    timestampUtc: '2026-10-10T00:00:10.1Z', decodeStatus: 'UNAMBIGUOUS_LOCAL_TO_UTC', unchangedValue: '9' }
  return { before: { ...expected }, after: { ...expected }, fingerprintSha256: expected.fingerprintSha256,
    timezoneId: expected.timezoneId, mappingHypothesis: 'LOCAL_ENCODED_PREDECLARED', completeCollection: true,
    queryStartUtc: '2026-10-10T00:00:10Z', queryEndUtc: '2026-10-10T00:00:10.2Z', startTick: '0', endTick: '200', frequency: '1000',
    instances: [{ name: 'pid_42_luid_0x0_0xa_phys_0', wmi: { ...sample }, pdh: { ...sample } }] }
}
function setTimestamp(sample, timestamp) {
  sample.timestampUtc = timestamp
  sample.rawTimestamp = (utcTicks(timestamp) + 116444736000000000n + BigInt(sample.utcOffsetTicks)).toString()
}
test('stable value with fresh collection timestamps is valid clock-only evidence', () => {
  const first = fixture(), result = clockWindowVerdict(first, expected)
  assert.equal(result.status, 'PASS_CLOCK_WINDOW_ONLY')
  const second = fixture()
  for (const source of ['wmi', 'pdh']) setTimestamp(second.instances[0][source], '2026-10-10T00:00:10.1000001Z')
  assert.equal(clockWindowVerdict(second, expected, result.highWater).status, 'PASS_CLOCK_WINDOW_ONLY')
  assert.equal(clockWindowVerdict(first, expected, result.highWater).reason, 'SOURCE_HIGH_WATER')
})
test('WMI and PDH agreement cannot replace a native UTC reference', () => {
  const window = fixture()
  window.instances[0].wmi.timestampUtc = window.instances[0].pdh.timestampUtc = '2026-10-10T08:00:10.1Z'
  assert.equal(clockWindowVerdict(window, expected).reason, 'SOURCE_NOT_FRESH_AGAINST_UTC')
})
test('freshness boundaries preserve 100ns precision', () => {
  for (const [timestamp, pass] of [['00:00:08', true], ['00:00:07.9999999', false], ['00:00:10.45', true], ['00:00:10.4500001', false]]) {
    const window = fixture(); setTimestamp(window.instances[0].wmi, `2026-10-10T${timestamp}Z`)
    assert.equal(clockWindowVerdict(window, expected).status === 'PASS_CLOCK_WINDOW_ONLY', pass)
  }
})
test('missing identity, ambiguous DST, incomplete collection and clock jumps fail closed', () => {
  const mutations = [w => { w.after.pid++ }, w => { w.instances[0].pdh.decodeStatus = 'AMBIGUOUS' },
    w => { w.completeCollection = false }, w => { w.endTick = '900' }, w => { w.instances.push(structuredClone(w.instances[0])) },
    w => { w.fingerprintSha256 = 'changed' }, w => { w.instances[0].wmi.frequency = '1' },
    w => { w.instances[0].wmi.rawTimestamp = '1' }]
  for (const mutate of mutations) { const window = fixture(); mutate(window); assert.equal(clockWindowVerdict(window, expected).status, 'BLOCKED_CLOCK_WINDOW') }
})
test('changing adapters cannot extend or reset the previous accepted collection', () => {
  const first = clockWindowVerdict(fixture(), expected)
  for (const mode of ['replace', 'add', 'remove']) {
    const window = fixture()
    for (const source of ['wmi', 'pdh']) setTimestamp(window.instances[0][source], '2026-10-10T00:00:10.1000001Z')
    const extra = structuredClone(window.instances[0]); extra.name = 'pid_42_luid_0x0_0xb_phys_0'
    if (mode === 'replace') window.instances = [extra]
    if (mode === 'add') window.instances.push(extra)
    if (mode === 'remove') window.instances = []
    assert.equal(clockWindowVerdict(window, expected, first.highWater).status, 'BLOCKED_CLOCK_WINDOW')
  }
})
test('PDH valid/new data statuses pass while no-instance fails', () => {
  for (const [cStatus, pass] of [[0, true], [1, true], [0x800007d1, false]]) {
    const window = fixture(); window.instances[0].pdh.cStatus = cStatus
    assert.equal(clockWindowVerdict(window, expected).status === 'PASS_CLOCK_WINDOW_ONLY', pass)
  }
})
test('fingerprint schema and fail-stop use production code with offline sources in both PowerShell runtimes', () => {
  const source = fs.readFileSync(new URL('../diagnostics/Capture-E12ClockFingerprint.ps1', import.meta.url), 'utf8')
  const validator = source.slice(source.indexOf('function Validate-FingerprintSource'), source.indexOf('$record=[ordered]'))
  const loop = source.slice(source.indexOf('try {\n  foreach($source in $sources)'), source.indexOf('$record.endUtc='))
  assert.ok(validator.includes('UNKNOWN_FINGERPRINT_SOURCE') && loop.includes('Save-Json'))
  const command = `$ErrorActionPreference='Stop';${validator}
    function Save-Json($Path,$Value){$script:saved+=,($Value|ConvertTo-Json -Depth 15|ConvertFrom-Json)}
    $directory='fixture';$api=@('System32/pdh.dll','System32/wbem/WmiPerfInst.dll','System32/drivers/dxgkrnl.sys')|ForEach-Object {
      @{path=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('Windows')) $_));fileVersion='1';productVersion='1';sha256=('a'*64)} }
    foreach($mode in @('ok','nullOS','manyOS','missingDriver','unknownDriver','duplicateGPU','missingFile','wrongPath','wrongHash','missingOffset','missingDST','missingRules','failure','late')) {
      $script:calls=0;$script:saved=@();$record=[ordered]@{steps=@();status='RUNNING';error=$null}
      $script:rows=@(@(@{Version='10';BuildNumber='1'}),@(@{Name='GPU';DriverVersion='1';PNPDeviceID='device'}),@($api),
        @(@{id='Taipei Standard Time';baseUtcOffsetTicks='288000000000';supportsDaylightSavingTime=$false;adjustmentRules=@();stopwatchFrequency='10000000'}))
      switch($mode) {
        'nullOS' {$script:rows[0][0].Version=$null} 'manyOS' {$script:rows[0]=@($script:rows[0][0],$script:rows[0][0])}
        'missingDriver' {$script:rows[1][0].DriverVersion=''} 'unknownDriver' {$script:rows[1][0].DriverVersion='UNKNOWN'}
        'duplicateGPU' {$script:rows[1]=@($script:rows[1][0],$script:rows[1][0])}
        'missingFile' {$script:rows[2]=@($api[0],$api[1])}
        'wrongPath' {$script:rows[2]=@($api|ForEach-Object {$copy=$_.Clone();$copy.path='wrong';$copy})}
        'wrongHash' {$script:rows[2]=@($api|ForEach-Object {$copy=$_.Clone();$copy.sha256='bad';$copy})}
        'missingOffset' {$script:rows[3][0].baseUtcOffsetTicks=$null} 'missingRules' {$script:rows[3][0].adjustmentRules=$null}
        'missingDST' {$script:rows[3][0].supportsDaylightSavingTime=$null}
      }
      $sources=@();foreach($name in @('os','gpu','apiFiles','timezone')) {
        $sources+=@{name=$name;read={
          $index=$script:calls;$script:calls++
          if($mode -eq 'failure' -and $index -eq 0){throw 'STUB_FAILURE'}
          if($mode -eq 'late' -and $index -eq 0){Start-Sleep -Milliseconds 2100}
          $script:rows[$index]
        }}
      }
      ${loop}
      $expectedCalls=switch($mode){'ok'{4} 'nullOS'{1} 'manyOS'{1} 'missingDriver'{2} 'unknownDriver'{2} 'duplicateGPU'{2} 'missingFile'{3} 'wrongPath'{3} 'wrongHash'{3} 'missingOffset'{4} 'missingDST'{4} 'missingRules'{4} default{1}}
      if($script:calls -ne $expectedCalls -or $script:saved.Count -ne $expectedCalls){throw ('FAIL_STOP_'+$mode)}
      if(($mode -eq 'ok') -ne ($record.status -eq 'PASS_ENVIRONMENT_FINGERPRINT_ONLY')){throw ('VERDICT_'+$mode)}
      if($mode -ne 'ok' -and -not $script:saved[-1].error){throw ('ERROR_NOT_PRESERVED_'+$mode)}
    };'FINGERPRINT_OFFLINE_PASS'`
  for (const executable of ['pwsh.exe', 'powershell.exe']) {
    const env = { ...process.env, E12_FINGERPRINT_SOURCE: new URL('../diagnostics/Capture-E12ClockFingerprint.ps1', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') }; if (executable === 'powershell.exe') delete env.PSModulePath
    const parsed = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($env:E12_FINGERPRINT_SOURCE,[ref]$tokens,[ref]$errors);if($errors.Count){throw ($errors|Out-String)}"], {env,encoding:'utf8',windowsHide:true,timeout:10000})
    assert.equal(parsed.status, 0, parsed.stderr)
    const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', command], { env, encoding: 'utf8', windowsHide: true, timeout: 15000 })
    assert.equal(result.status, 0, `${executable}: ${result.error?.message ?? result.stderr}`)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /FINGERPRINT_OFFLINE_PASS/)
  }
})
