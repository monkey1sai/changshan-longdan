[CmdletBinding(PositionalBinding=$false)]
param([Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$SourceHead, [Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference='Stop'
if ($SourceHead -cnotmatch '^[a-f0-9]{40}$' -or $RunId -cnotmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') { throw 'FINGERPRINT_IDENTITY_REQUIRED' }
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$destination=[IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
$evidenceRoot=[IO.Path]::GetFullPath((Join-Path $repoRoot 'release/e12'))
if (-not $destination.StartsWith($evidenceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'FINGERPRINT_OUTPUT_OUTSIDE_ROOT' }
$directory=[IO.Path]::GetDirectoryName($destination)
if (-not (Test-Path -LiteralPath $directory) -or @(Get-ChildItem -LiteralPath $directory -Force).Count -ne 0) { throw 'FINGERPRINT_REQUIRES_EMPTY_DIRECTORY' }
$cursor=$directory
while ($cursor.Length -ge $repoRoot.Length) {
  if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'UNSAFE_FINGERPRINT_PATH' }
  if ($cursor -ceq $repoRoot) { break }; $cursor=[IO.Path]::GetDirectoryName($cursor)
}
function Save-Json([string]$Path,$Value) {
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 15));$stream.Write($bytes,0,$bytes.Length) }
  finally { $stream.Dispose() }
}
function Transition-Data($Value) {
  [ordered]@{isFixedDateRule=$Value.IsFixedDateRule;month=$Value.Month;week=$Value.Week;day=$Value.Day;
    dayOfWeek=[int]$Value.DayOfWeek;timeOfDay=$Value.TimeOfDay.ToString('HH:mm:ss.fffffff')}
}
function Validate-FingerprintSource([string]$Name,$Rows) {
  if ($Rows.Count -eq 0) { throw 'EMPTY_FINGERPRINT_SOURCE' }
  $required=switch($Name) { 'os' {@('Version','BuildNumber')} 'gpu' {@('Name','DriverVersion','PNPDeviceID')} 'apiFiles' {@('path','fileVersion','productVersion','sha256')} 'timezone' {@('id','baseUtcOffsetTicks','stopwatchFrequency')} default {throw 'UNKNOWN_FINGERPRINT_SOURCE'} }
  foreach($row in $Rows) { foreach($field in $required) {
    $value=[string]$row.$field
    if ([string]::IsNullOrWhiteSpace($value) -or $value.Trim() -match '^(UNKNOWN|UNVERIFIED|N/A)$') { throw ('MISSING_FINGERPRINT_FIELD_'+$field) }
  } }
  if (($Name -ceq 'os' -and $Rows.Count -ne 1) -or ($Name -ceq 'apiFiles' -and $Rows.Count -ne 3) -or ($Name -ceq 'timezone' -and $Rows.Count -ne 1)) { throw 'FINGERPRINT_SOURCE_COUNT' }
  if ($Name -ceq 'gpu' -and @($Rows | Group-Object PNPDeviceID | Where-Object Count -gt 1).Count) { throw 'DUPLICATE_GPU_ID' }
  if ($Name -ceq 'apiFiles') {
    $paths=@('System32/pdh.dll','System32/wbem/WmiPerfInst.dll','System32/drivers/dxgkrnl.sys')
    for($i=0;$i -lt 3;$i++) {
      $expected=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('Windows')) $paths[$i]))
      if ($Rows[$i].path -cne $expected -or $Rows[$i].sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'FINGERPRINT_API_FILE_IDENTITY' }
    }
  }
  if ($Name -ceq 'timezone') {
    $row=$Rows[0]
    if ($row.baseUtcOffsetTicks -cnotmatch '^-?(0|[1-9][0-9]*)$' -or [decimal]$row.baseUtcOffsetTicks -lt -504000000000d -or [decimal]$row.baseUtcOffsetTicks -gt 504000000000d -or
      $row.stopwatchFrequency -cnotmatch '^[1-9][0-9]*$' -or $row.supportsDaylightSavingTime -isnot [bool] -or $null -eq $row.adjustmentRules) { throw 'FINGERPRINT_TIMEZONE_FIELDS' }
  }
}
$record=[ordered]@{schemaVersion=1;kind='CLOCK_ENVIRONMENT_FINGERPRINT_ONLY';runId=$RunId;sourceHead=$SourceHead;
  scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();
  producerImplementation='UNKNOWN';loadedModule='UNKNOWN';clockMapping='UNVERIFIED';counterWindows=0;playerLaunched=$false;
  startUtc=[DateTime]::UtcNow.ToString('o');endUtc=$null;status='RUNNING';error=$null;steps=@()}
$sources=@(
  @{name='os';read={ @(Get-CimInstance -ClassName Win32_OperatingSystem -OperationTimeoutSec 2 | Select-Object Version,BuildNumber) }},
  @{name='gpu';read={ @(Get-CimInstance -ClassName Win32_VideoController -OperationTimeoutSec 2 | Select-Object Name,DriverVersion,PNPDeviceID) }},
  @{name='apiFiles';read={
    @('System32/pdh.dll','System32/wbem/WmiPerfInst.dll','System32/drivers/dxgkrnl.sys') | ForEach-Object {
      $path=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('Windows')) $_))
      $item=Get-Item -LiteralPath $path
      [ordered]@{path=$path;fileVersion=$item.VersionInfo.FileVersion;productVersion=$item.VersionInfo.ProductVersion;
        sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
    }
  }},
  @{name='timezone';read={
    $zone=[TimeZoneInfo]::Local
    $rules=@($zone.GetAdjustmentRules() | ForEach-Object {
      $rule=[ordered]@{dateStart=$_.DateStart.ToString('yyyy-MM-dd');dateEnd=$_.DateEnd.ToString('yyyy-MM-dd');
        daylightDeltaTicks=$_.DaylightDelta.Ticks.ToString();start=(Transition-Data $_.DaylightTransitionStart);
        end=(Transition-Data $_.DaylightTransitionEnd)}
      foreach($property in @('BaseUtcOffsetDelta','NoDaylightTransitions')) {
        if ($_.PSObject.Properties.Name -contains $property) { $rule[$property]=$_.PSObject.Properties[$property].Value.ToString() }
      }
      $rule
    })
    [ordered]@{id=$zone.Id;baseUtcOffsetTicks=$zone.BaseUtcOffset.Ticks.ToString();supportsDaylightSavingTime=$zone.SupportsDaylightSavingTime;
      adjustmentRules=$rules;stopwatchFrequency=[Diagnostics.Stopwatch]::Frequency.ToString()}
  }}
)
try {
  foreach($source in $sources) {
    $step=[ordered]@{name=$source.name;startUtc=[DateTime]::UtcNow.ToString('o');endUtc=$null;
      startTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString();endTick=$null;elapsedMs=$null;raw=$null;error=$null}
    try {
      $step.raw=@(& $source.read);Validate-FingerprintSource $source.name $step.raw
    }
    catch { $step.error=$_.Exception.Message }
    $step.endTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString();$step.endUtc=[DateTime]::UtcNow.ToString('o')
    $step.elapsedMs=([decimal]$step.endTick-[decimal]$step.startTick)*1000d/[Diagnostics.Stopwatch]::Frequency
    if ($step.elapsedMs -gt 2000) { $step.error='FINGERPRINT_SOURCE_DEADLINE' }
    $record.steps+=,$step
    Save-Json (Join-Path $directory ('fingerprint-step-{0:00}.json' -f $record.steps.Count)) $step
    if ($step.error) { throw $step.error }
  }
  $record.status='PASS_ENVIRONMENT_FINGERPRINT_ONLY'
} catch { $record.status='BLOCKED_FINGERPRINT';$record.error=$_.Exception.Message }
$record.endUtc=[DateTime]::UtcNow.ToString('o')
Save-Json $destination $record
if ($record.status -ceq 'PASS_ENVIRONMENT_FINGERPRINT_ONLY') { exit 0 };exit 2
