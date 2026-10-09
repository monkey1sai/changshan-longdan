[CmdletBinding(PositionalBinding=$false)]
param([Parameter(Mandatory=$true)][int]$TargetPid,
  [Parameter(Mandatory=$true)][string]$IdentityPath,
  [Parameter(Mandatory=$true)][string]$FingerprintPath,
  [Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceRoot=[IO.Path]::GetFullPath((Join-Path $root 'release/e12'))
foreach($path in @($IdentityPath,$FingerprintPath,$OutputPath)) {
  $full=[IO.Path]::GetFullPath($path)
  if (-not $full.StartsWith($evidenceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'CLOCK_PATH_OUTSIDE_ROOT' }
  $cursor=if(Test-Path -LiteralPath $full){$full}else{[IO.Path]::GetDirectoryName($full)}
  while($cursor.Length -ge $root.Length) {
    if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'CLOCK_REPARSE_PATH'}
    if($cursor -ceq $root){break};$cursor=[IO.Path]::GetDirectoryName($cursor)
  }
}
if(Test-Path -LiteralPath $OutputPath){throw 'CLOCK_EVIDENCE_EXISTS'}
$identity=Get-Content -LiteralPath $IdentityPath -Raw|ConvertFrom-Json
$fingerprint=Get-Content -LiteralPath $FingerprintPath -Raw|ConvertFrom-Json
if($TargetPid -le 0 -or $identity.pid -ne $TargetPid -or $fingerprint.status -cne 'PASS_ENVIRONMENT_FINGERPRINT_ONLY'){throw 'CLOCK_INPUT_IDENTITY'}
$fingerprintHash=(Get-FileHash -LiteralPath $FingerprintPath -Algorithm SHA256).Hash.ToLowerInvariant()
$zoneRecord=@($fingerprint.steps|Where-Object name -CEQ 'timezone')[0].raw[0]
[TimeZoneInfo]::ClearCachedData()
$zone=[TimeZoneInfo]::Local
# This run is intentionally limited to the captured fixed Taipei clock; other rule sets need a new reviewed method.
if($zone.Id -cne $zoneRecord.id -or $zone.Id -cne 'Taipei Standard Time' -or
  $zone.BaseUtcOffset.Ticks.ToString() -cne $zoneRecord.baseUtcOffsetTicks -or $zone.SupportsDaylightSavingTime -or
  $zone.GetAdjustmentRules().Length -ne 0 -or $zoneRecord.adjustmentRules.Count -ne 0){throw 'CLOCK_TIMEZONE_CHANGED_OR_UNSUPPORTED'}
# Compose only the already-reviewed interop declaration, never execute the legacy diagnostic entry point.
$legacy=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Capture-E12ClockComparison.ps1') -Raw
$interopMatches=[regex]::Matches($legacy,"(?ms)^Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@")
if($interopMatches.Count -ne 1){throw 'CLOCK_INTEROP_DECLARATION_CHANGED'}
Add-Type -TypeDefinition $interopMatches[0].Groups[1].Value
[E12ClockComparison.Native]::CheckLayout()
function Get-Identity {
  $process=[Diagnostics.Process]::GetProcessById($TargetPid)
  try {
    $image=$process.MainModule.FileName
    [ordered]@{pid=$process.Id;processStartUtc=$process.StartTime.ToUniversalTime().ToString('o');
      imagePath=$image;imageSha256=(Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant();runId=$identity.runId}
  } finally {$process.Dispose()}
}
function Assert-Identity($Actual) {
  if($Actual.pid -ne $identity.pid -or $Actual.processStartUtc -cne $identity.processStartUtc -or
    $Actual.imagePath -ine $identity.imagePath -or $Actual.imageSha256 -cne $identity.imageSha256){throw 'CLOCK_PLAYER_IDENTITY_CHANGED'}
}
function Start-Source {
  [ordered]@{queryStartUtc=[DateTime]::FromFileTimeUtc([long][E12ClockComparison.Native]::UtcFileTime()).ToString('o');
    startTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString();queryEndUtc=$null;endTick=$null;
    frequency=[Diagnostics.Stopwatch]::Frequency.ToString()}
}
function End-Source($Source) {
  $Source.endTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString()
  $Source.queryEndUtc=[DateTime]::FromFileTimeUtc([long][E12ClockComparison.Native]::UtcFileTime()).ToString('o')
  $Source.elapsedMs=([decimal]$Source.endTick-[decimal]$Source.startTick)*1000d/[Diagnostics.Stopwatch]::Frequency
}
function Save-SourceCheckpoint([string]$Name,$Query,$Raw,$SourceError) {
  $snapshot=[ordered]@{runId=$identity.runId;pid=$TargetPid;source=$Name;query=$Query;raw=$Raw;error=$SourceError}
  $stream=[IO.File]::Open(($OutputPath+'.'+$Name+'.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($snapshot|ConvertTo-Json -Depth 15));$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
}
function Decode-Clock([string]$Raw,[string]$Frequency) {
  [long]$ticks=0
  if($Frequency -cne '10000000' -or $Raw -cnotmatch '^(0|[1-9][0-9]*)$' -or -not [long]::TryParse($Raw,[ref]$ticks) -or $ticks -gt 2650467743999999999){throw 'CLOCK_RAW_OR_FREQUENCY'}
  $wall=[DateTime]::SpecifyKind([DateTime]::FromFileTimeUtc($ticks),[DateTimeKind]::Unspecified)
  if($zone.IsInvalidTime($wall) -or $zone.IsAmbiguousTime($wall)){throw 'CLOCK_DST_UNRESOLVED'}
  [ordered]@{rawTimestamp=$Raw;frequency=$Frequency;timestampUtc=[TimeZoneInfo]::ConvertTimeToUtc($wall,$zone).ToString('o');
    utcOffsetTicks=$zone.GetUtcOffset($wall).Ticks.ToString();decodeStatus='UNAMBIGUOUS_LOCAL_TO_UTC'}
}
$record=[ordered]@{schemaVersion=2;kind='OWNED_PLAYER_CLOCK_WINDOW';before=$null;after=$null;fingerprintSha256=$fingerprintHash;
  timezoneId=$zone.Id;mappingHypothesis='LOCAL_ENCODED_PREDECLARED';completeCollection=$false;instances=@();wmiQuery=$null;
  maximumInstances=16;pdhSequences=0;maximumPdhCalls=80;wmiRaw=$null;error=$null;scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()}
try {
  $record.before=Get-Identity;Assert-Identity $record.before
  $record.wmiQuery=Start-Source
  $sourceError=$null
  try {
    $rows=@(Get-CimInstance -ClassName Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory -Filter "Name LIKE 'pid[_]${TargetPid}[_]%'" -Property Name,Timestamp_Sys100NS,Frequency_Sys100NS -OperationTimeoutSec 2)
    $record.wmiRaw=@($rows|ForEach-Object {[ordered]@{name=$_.Name;timestampSys100NS=$_.Timestamp_Sys100NS.ToString();frequencySys100NS=$_.Frequency_Sys100NS.ToString()}})
  } catch {$sourceError=$_.Exception.Message}
  finally {End-Source $record.wmiQuery;Save-SourceCheckpoint 'wmi' $record.wmiQuery $record.wmiRaw $sourceError}
  if($sourceError){throw $sourceError};if($record.wmiQuery.elapsedMs -gt 2000){throw 'CLOCK_SOURCE_DEADLINE'}
  if($rows.Count -eq 0 -or $rows.Count -gt 16){throw 'CLOCK_INSTANCE_COUNT'}
  $names=@{}
  foreach($row in $rows) {
    if($row.Name -cnotmatch "^pid_${TargetPid}_luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+_phys_[0-9]+$" -or $names.ContainsKey($row.Name)){throw 'CLOCK_INSTANCE_NAME_OR_DUPLICATE'}
    $names[$row.Name]=$true
  }
  foreach($row in $rows) {
    $item=[ordered]@{name=$row.Name;wmi=(Decode-Clock $row.Timestamp_Sys100NS.ToString() $row.Frequency_Sys100NS.ToString());pdh=$null}
    $item.wmi.apiStatus=0;$item.wmi.counterType=$null;$item.wmi.query=$record.wmiQuery
    $record.instances+=,$item
    $pdhQuery=Start-Source
    $sourceError=$null
    try {
      $record.pdhSequences++
      $raw=[E12ClockComparison.Native]::Read("\GPU Process Memory($($row.Name))\Dedicated Usage")
      $item.pdh=[ordered]@{apiStatus=$raw.ApiStatus;cStatus=$null;counterType=$null;stage=$raw.Stage;rawTimestamp=$null;query=$pdhQuery}
      if($raw.ApiStatus -eq 0 -and $raw.Stage -ceq 'Raw') {
        $item.pdh.cStatus=$raw.CStatus;$item.pdh.counterType=$raw.CounterType;$item.pdh.rawTimestamp=$raw.TimeStamp
      }
    } catch {$sourceError=$_.Exception.Message}
    finally {End-Source $pdhQuery;Save-SourceCheckpoint ('pdh-'+$record.pdhSequences) $pdhQuery $item.pdh $sourceError}
    if($sourceError){throw $sourceError};if($pdhQuery.elapsedMs -gt 2000){throw 'CLOCK_SOURCE_DEADLINE'}
    # Preserve statuses even when no valid timestamp is available. No usage fields are serialized.
    if($raw.ApiStatus -eq 0 -and $raw.CStatus -in @(0,1) -and $raw.CounterType -eq 65792) {
      $decoded=Decode-Clock $raw.TimeStamp '10000000'
      foreach($key in $decoded.Keys){$item.pdh[$key]=$decoded[$key]}
    }
    if($raw.ApiStatus -ne 0 -or $raw.CStatus -notin @(0,1) -or $raw.CounterType -ne 65792){throw 'CLOCK_PDH_STATUS_OR_TYPE'}
  }
  $record.after=Get-Identity;Assert-Identity $record.after
  $record.completeCollection=$true
} catch {$record.error=$_.Exception.Message}
$stream=[IO.File]::Open($OutputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Depth 15));$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
if($record.error){exit 2};exit 0
