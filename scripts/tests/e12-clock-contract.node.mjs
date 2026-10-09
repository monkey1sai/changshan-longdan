import test from 'node:test'
import assert from 'node:assert/strict'
import { clockWindowVerdict, fingerprintContents, validateClockReady, extendClockTimeline } from '../lib/e12-clock-contract.mjs'
import { nextClockWindow, stopOwned, timeoutWithin, confirmOwnedExit, collectClockWindows } from '../e12-player-clock.mjs'
import { utcTicks } from '../lib/e12-performance.mjs'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('new READY source/meta pairs have valid unique GUIDs, rejecting malformed fixtures', () => {
  function checkPairs(pairs, files) {
    for (const source of pairs) {
      assert.ok(files.has(source), `missing source: ${source}`)
      assert.ok(files.has(`${source}.meta`), `missing meta: ${source}`)
      const guid = /^guid: (\S+)\s*$/m.exec(files.get(`${source}.meta`))?.[1]
      assert.match(guid ?? '', /^[0-9a-f]{32}$/i)
      assert.notEqual(guid, '0'.repeat(32))
      const matches = [...files].filter(([name, contents]) => name.endsWith('.meta') &&
        /^guid: (\S+)\s*$/m.exec(contents)?.[1]?.toLowerCase() === guid.toLowerCase())
      assert.equal(matches.length, 1, `duplicate GUID: ${source}`)
    }
  }
  const source = 'fixture.cs', valid = 'a08e19558b4a44e5bec064ef0360aa2a'
  const fixture = () => new Map([[source, ''], [`${source}.meta`, `guid: ${valid}\n`]])
  checkPairs([source], fixture())
  for (const invalid of [`${valid}a`, '0'.repeat(32)]) {
    const files = fixture(); files.set(`${source}.meta`, `guid: ${invalid}\n`)
    assert.throws(() => checkPairs([source], files))
  }
  for (const missing of [source, `${source}.meta`]) {
    const files = fixture(); files.delete(missing)
    assert.throws(() => checkPairs([source], files))
  }
  const duplicate = fixture(); duplicate.set('other.meta', `guid: ${valid.toUpperCase()}\n`)
  assert.throws(() => checkPairs([source], duplicate))
  const root = fileURLToPath(new URL('../../unity/ChangshanLongdan/Assets/', import.meta.url))
  const files = new Map()
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) scan(full)
      else if (entry.name.endsWith('.meta')) files.set(full, fs.readFileSync(full, 'utf8'))
    }
  }
  scan(root)
  const pairs = ['Character/Runtime/E12ClockReady.cs', 'Foundation/Tests/EditMode/E12ClockReadyEditTests.cs']
    .map(relative => path.join(root, relative))
  for (const file of pairs) if (fs.existsSync(file)) files.set(file, '')
  checkPairs(pairs, files)
})

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
test('each source must fit its own query window and an error cannot pass', () => {
  const window = fixture(); window.schemaVersion = 2
  window.wmiRaw=window.instances.map(i=>({name:i.name,timestampSys100NS:i.wmi.rawTimestamp,frequencySys100NS:i.wmi.frequency}))
  for (const source of ['wmi', 'pdh']) window.instances[0][source].query = structuredClone(window)
  assert.equal(clockWindowVerdict(window, expected).status, 'PASS_CLOCK_WINDOW_ONLY')
  window.instances[0].pdh.query.queryStartUtc = '2026-10-10T00:00:20Z'
  window.instances[0].pdh.query.queryEndUtc = '2026-10-10T00:00:20.2Z'
  assert.equal(clockWindowVerdict(window, expected).reason, 'SOURCE_NOT_FRESH_AGAINST_UTC')
  window.error = 'failed'; assert.equal(clockWindowVerdict(window, expected).reason, 'SOURCE_ERROR')
})
test('bracket comparison retains environment semantics but removes observation identity', () => {
  const record = {status:'PASS_ENVIRONMENT_FINGERPRINT_ONLY',error:null,runId:'one',steps:[
    {name:'os',raw:[{Version:'10',BuildNumber:'1'}]}, {name:'gpu',raw:[{PNPDeviceID:'a',DriverVersion:'1'}]},
    {name:'apiFiles',raw:[{sha256:'api'}]}, {name:'timezone',raw:[{id:'Taipei',baseUtcOffsetTicks:'288000000000',adjustmentRules:[],stopwatchFrequency:'10000000'}]}]}
  const other = structuredClone(record); other.runId='two';other.steps[0].elapsedMs=100
  assert.deepEqual(fingerprintContents(record),fingerprintContents(other))
  for (const mutate of [r=>{r.steps[1].raw[0].DriverVersion='2'},r=>{r.steps[2].raw[0].sha256='changed'},r=>{r.steps[3].raw[0].adjustmentRules=[{rule:'changed'}]}]) {
    const changed = structuredClone(record); mutate(changed)
    assert.notDeepEqual(fingerprintContents(record),fingerprintContents(changed))
  }
  assert.throws(()=>fingerprintContents({...record,status:'BLOCKED_FINGERPRINT'}))
})
test('readiness rejects partial JSON, wrong Player generation, graphics, frames and errors', () => {
  const identity={...expected}, report={...identity,status:'READY_CLOCK_ONLY',graphicsApi:'Direct3D11',width:1920,height:1080,
    assetStatus:'Ready',framesSinceEntry:120,errorCount:0,development:true,batchMode:false,focused:true,utc:'2026-10-10T00:00:10Z',monotonicTick:'100',frequency:'10000000'}
  assert.equal(validateClockReady(report,identity),report)
  assert.throws(()=>JSON.parse('{"status":'))
  for (const change of [{pid:43},{processStartUtc:'2026-10-10T00:00:01Z'},{runId:'other'},{framesSinceEntry:119},
    {graphicsApi:'Null'},{errorCount:1},{focused:false},{frequency:'0'},{assetStatus:'Loading'}])
    assert.throws(()=>validateClockReady({...report,...change},identity))
})
test('deadline reserves post evidence, stops fourth window and protects non-owned processes', () => {
  assert.equal(timeoutWithin(90000000000n,20000,25000,0n),20000)
  assert.equal(timeoutWithin(90000000000n,20000,25000,60000000000n),5000)
  assert.throws(()=>timeoutWithin(90000000000n,20000,25000,65000000000n))
  assert.deepEqual([0,1,2].map(n=>nextClockWindow(n)),[1,2,3])
  assert.throws(()=>nextClockWindow(3));assert.throws(()=>nextClockWindow(1,true))
  let killed=0;const child={exitCode:null,signalCode:null,kill(){killed++}}
  assert.throws(()=>stopOwned(child,new Set()));assert.equal(killed,0)
  stopOwned(child,new Set([child]));assert.equal(killed,1)
  child.exitCode=0;stopOwned(child,new Set([child]));assert.equal(killed,1)
})
test('controller collection stops after first rejection and never launches another window', async () => {
  let captures=0, pauses=0, accepted=0
  await assert.rejects(collectClockWindows(async()=>{captures++;return {...fixture(),schemaVersion:2,error:'source failed',pdhSequences:0,maximumInstances:16}},
    expected,async()=>{pauses++},()=>{accepted++}),/CLOCK_WINDOW_REJECTED/)
  assert.equal(captures,1);assert.equal(pauses,0);assert.equal(accepted,0)
})
test('cross-query UTC jumps and monotonic reversal fail without rebasing the accepted timeline', () => {
  const first=fixture(), state=extendClockTimeline([first])
  const next={...first,queryStartUtc:'2026-10-10T00:00:11Z',queryEndUtc:'2026-10-10T00:00:11.2Z',startTick:'1000',endTick:'1200'}
  assert.ok(extendClockTimeline([next],state))
  assert.throws(()=>extendClockTimeline([{...next,queryStartUtc:'2026-10-10T00:00:12Z',queryEndUtc:'2026-10-10T00:00:12.2Z'}],state),/DISCONTINUITY/)
  assert.throws(()=>extendClockTimeline([{...next,startTick:'1'}],state),/REVERSED/)
  assert.equal(state.lastTick,200n)
})
test('owned cleanup returns unconfirmed rather than waiting forever', async () => {
  let killed=0;const child={exitCode:null,signalCode:null,kill(){killed++}}
  assert.equal(await confirmOwnedExit(child,new Set([child]),new Promise(()=>{}),1),null)
  assert.equal(killed,1)
  assert.equal(await confirmOwnedExit(child,new Set([child]),Promise.resolve({exitConfirmed:false,code:null}),1),null)
  const closed={exitConfirmed:true,code:0};child.exitCode=0
  assert.equal(await confirmOwnedExit(child,new Set([child]),Promise.resolve(closed),1),closed)
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
test('Player window production loop rejects empty, excessive, malformed and failed sources without native queries', () => {
  const source = fs.readFileSync(new URL('../diagnostics/Capture-E12PlayerClockWindow.ps1', import.meta.url), 'utf8')
  const functions = source.slice(source.indexOf('function Assert-Identity'), source.indexOf('$record=[ordered]'))
    .replaceAll('[E12ClockComparison.Native]::UtcFileTime()', '([DateTime]::UtcNow.ToFileTimeUtc().ToString())')
  const loop = source.slice(source.indexOf('$record=[ordered]'),source.indexOf('$stream=[IO.File]',source.indexOf('$record=[ordered]')))
    .replaceAll('[E12ClockComparison.Native]::Read(', '(Read-Stub ')
  assert.ok(functions.includes('Decode-Clock') && loop.includes('CLOCK_INSTANCE_COUNT'))
  const command = `$ErrorActionPreference='Stop';${functions}
    $TargetPid=42;$identity=@{pid=42;processStartUtc='2026-10-10T00:00:00Z';imagePath='fixture';imageSha256='hash';runId='run'}
    $zone=[TimeZoneInfo]::FindSystemTimeZoneById('Taipei Standard Time');$fingerprintHash='fixture';$PSCommandPath=$env:E12_WINDOW_SCRIPT
    function Save-SourceCheckpoint($Name,$Query,$Raw,$Error){$script:checkpoints+=,(@{source=$Name;query=$Query;raw=$Raw;error=$Error}|ConvertTo-Json -Depth 15|ConvertFrom-Json)}
    function Get-Identity { $copy=$identity.Clone();if($mode -eq 'identity'){$copy.pid=43};$copy }
    function Get-CimInstance($ClassName,$Filter,$Property,$OperationTimeoutSec) {
      $script:wmiCalls++
      if($Filter -cne 'Name LIKE ''pid[_]42[_]%''' -or ($Property -join ',') -cne 'Name,Timestamp_Sys100NS,Frequency_Sys100NS'){throw 'QUERY_ALLOWLIST'}
      if($mode -eq 'wmiError'){throw 'STUB_WMI_ERROR'}
      $rows=@();$count=switch($mode){'empty'{0} 'excess'{17} 'duplicate'{2} 'laterPdh'{2} default{1}}
      for($i=0;$i -lt $count;$i++){
        $name=if($mode -eq 'duplicate'){'pid_42_luid_0x0_0xa_phys_0'}elseif($mode -eq 'malformed'){'pid_43_bad'}else{'pid_42_luid_0x0_0xa_phys_'+$i}
        $rows+=[pscustomobject]@{Name=$name;Timestamp_Sys100NS=([DateTime]::UtcNow.ToFileTimeUtc()+288000000000L);Frequency_Sys100NS=10000000L}
      }
      if($mode -eq 'late'){Start-Sleep -Milliseconds 2100};$rows
    }
    function Read-Stub($Path) {
      $script:pdhCalls++
      if($mode -eq 'latePdh' -or ($mode -eq 'laterPdh' -and $script:pdhCalls -eq 2)){Start-Sleep -Milliseconds 2100}
      [pscustomobject]@{Stage='Raw';ApiStatus=$(if($mode -eq 'pdhError'){5}else{0});CStatus=$(if($mode -eq 'noInstance'){2147485649}else{1});CounterType=65792;
        TimeStamp=([DateTime]::UtcNow.ToFileTimeUtc()+288000000000L).ToString()}
    }
    foreach($mode in @('ok','identity','empty','excess','duplicate','malformed','wmiError','late','pdhError','noInstance','latePdh','laterPdh')) {
      $script:wmiCalls=0;$script:pdhCalls=0;$script:checkpoints=@()
      ${loop}
      if($mode -eq 'ok') {if($record.error -or -not $record.completeCollection -or $record.pdhSequences -ne 1){throw 'VALID_WINDOW_REJECTED'}}
      elseif(-not $record.error -or $record.completeCollection){throw ('INVALID_WINDOW_ACCEPTED_'+$mode)}
      $expectedWmi=if($mode -eq 'identity'){0}else{1};$expectedPdh=if($mode -eq 'laterPdh'){2}elseif($mode -in @('ok','pdhError','noInstance','latePdh')){1}else{0}
      if($script:wmiCalls -ne $expectedWmi -or $script:pdhCalls -ne $expectedPdh){throw ('QUERY_AFTER_FAILURE_'+$mode)}
      if($script:checkpoints.Count -ne $expectedWmi+$expectedPdh){throw ('CHECKPOINT_MISSING_'+$mode)}
      if($mode -in @('latePdh','laterPdh') -and -not $script:checkpoints[-1].raw.rawTimestamp){throw 'LATE_PDH_RAW_LOST'}
      if($mode -eq 'laterPdh' -and -not $script:checkpoints[1].raw.rawTimestamp){throw 'PREVIOUS_PDH_RAW_LOST'}
      if(($record|ConvertTo-Json -Depth 15) -match 'FirstValue|SecondValue|DedicatedUsage|dedicatedBytes'){throw 'USAGE_PERSISTED'}
    };'WINDOW_OFFLINE_PASS'`
  for (const executable of ['pwsh.exe','powershell.exe']) {
    const env={...process.env,E12_WINDOW_SCRIPT:new URL('../diagnostics/Capture-E12PlayerClockWindow.ps1',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')}
    if(executable==='powershell.exe')delete env.PSModulePath
    const parse = "$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($env:E12_WINDOW_SCRIPT,[ref]$tokens,[ref]$errors);if($errors.Count){throw ($errors|Out-String)}"
    const parsed=spawnSync(executable,['-NoProfile','-NonInteractive','-Command',parse],{env,encoding:'utf8',windowsHide:true,timeout:10000})
    assert.equal(parsed.status,0,parsed.stderr)
    const result=spawnSync(executable,['-NoProfile','-NonInteractive','-Command',command],{env,encoding:'utf8',windowsHide:true,timeout:20000})
    assert.equal(result.status,0,`${executable}: ${result.error?.message??result.stderr}`);assert.equal(result.stderr,'')
    assert.match(result.stdout,/WINDOW_OFFLINE_PASS/)
  }
})
