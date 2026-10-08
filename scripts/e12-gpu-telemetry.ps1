param([int]$TargetPid, [Parameter(Mandatory)][string]$Output, [string]$TimezoneId,
  [string]$OfflineClockFixture)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Output) { throw 'Refusing to overwrite telemetry' }
function Decode-SourceClock([string]$Raw, [string]$Frequency, [string]$Zone) {
  [long]$ticks = 0
  if ($Frequency -cne '10000000') { throw 'UNKNOWN_CLOCK_FREQUENCY' }
  if ($Raw -cnotmatch '^(0|[1-9][0-9]*)$' -or -not [long]::TryParse($Raw, [ref]$ticks) -or $ticks -gt 2650467743999999999) { throw 'INVALID_SOURCE_FILETIME' }
  if ([string]::IsNullOrEmpty($Zone)) { throw 'SOURCE_TIMEZONE_REQUIRED' }
  $rules = [TimeZoneInfo]::FindSystemTimeZoneById($Zone)
  $wall = [DateTime]::SpecifyKind([DateTime]::FromFileTimeUtc($ticks), [DateTimeKind]::Unspecified)
  if ($rules.IsInvalidTime($wall)) { throw 'INVALID_LOCAL_TIME' }
  if ($rules.IsAmbiguousTime($wall)) { throw 'AMBIGUOUS_LOCAL_TIME' }
  return [TimeZoneInfo]::ConvertTimeToUtc($wall, $rules).ToString('o')
}
# Offline mode exercises the production decoder without Get-Process, CIM, PDH, sleep or timezone autodetection.
if ($OfflineClockFixture) {
  $fixtures = Get-Content -LiteralPath $OfflineClockFixture -Raw | ConvertFrom-Json
  $results = foreach ($fixture in $fixtures) {
    try { [ordered]@{ id=$fixture.id; utc=(Decode-SourceClock $fixture.raw $fixture.frequency $fixture.zone); error=$null } }
    catch { [ordered]@{ id=$fixture.id; utc=$null; error=$_.Exception.Message } }
  }
  $stream = [IO.File]::Open($Output, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($results | ConvertTo-Json -Depth 5)); $stream.Write($bytes, 0, $bytes.Length) }
  finally { $stream.Dispose() }
  return
}
if ($TargetPid -le 0 -or -not $TimezoneId) { throw 'PLAYER_AND_SOURCE_TIMEZONE_REQUIRED' }
if ([TimeZoneInfo]::Local.Id -cne $TimezoneId) { throw 'SOURCE_TIMEZONE_RULE_CHANGED' }
$player = Get-Process -Id $TargetPid
$start = $player.StartTime.ToUniversalTime().ToString('o')
$counterClass = Get-CimClass Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory
foreach ($name in @('DedicatedUsage','SharedUsage','TotalCommitted')) {
  if (($counterClass.CimClassProperties[$name].Qualifiers['CounterType'].Value) -ne 65792) { throw 'Unsupported GPU counter type' }
}
$clock = [Diagnostics.Stopwatch]::StartNew()
$stream = [IO.File]::Open($Output, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
$nextDeadline = 0.0
try {
  while ($clock.Elapsed.TotalSeconds -lt 60) {
    if ($clock.Elapsed.TotalSeconds -lt $nextDeadline) { Start-Sleep -Milliseconds ([int][Math]::Ceiling(($nextDeadline-$clock.Elapsed.TotalSeconds)*1000)); continue }
    $player.Refresh()
    if ($player.HasExited -or $player.StartTime.ToUniversalTime().ToString('o') -cne $start) { break }
    $record = [ordered]@{ schemaVersion=2; pid=$TargetPid; processStart=$start; pidAfter=$null; processStartAfter=$null; seconds=$clock.Elapsed.TotalSeconds; utc=[DateTime]::UtcNow.ToString('o'); queryEndUtc=$null; provider='Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory'; timezoneId=$TimezoneId; clockMapping='OBSERVED_SOURCE_REQUIRES_PLAYER_VALIDATION'; scheduledSeconds=$nextDeadline; missedDeadlines=0; instances=$null; error=$null }
    try {
      if ([TimeZoneInfo]::Local.Id -cne $TimezoneId) { throw 'SOURCE_TIMEZONE_RULE_CHANGED' }
      $raw = @(Get-CimInstance Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory -Filter "Name LIKE 'pid_${TargetPid}_%'" -OperationTimeoutSec 2)
      $record.instances = @($raw | ForEach-Object { [ordered]@{ name=$_.Name; dedicatedBytes=$_.DedicatedUsage.ToString(); sharedBytes=$_.SharedUsage.ToString(); committedBytes=$_.TotalCommitted.ToString(); counterType=65792; timestampPerfTime=$_.Timestamp_PerfTime.ToString(); frequencyPerfTime=$_.Frequency_PerfTime.ToString(); timestampSys100Ns=$_.Timestamp_Sys100NS.ToString(); frequencySys100Ns=$_.Frequency_Sys100NS.ToString(); timestampUtc=(Decode-SourceClock $_.Timestamp_Sys100NS.ToString() $_.Frequency_Sys100NS.ToString() $TimezoneId) } })
      $after = Get-Process -Id $TargetPid
      try {
        $record.pidAfter = $after.Id; $record.processStartAfter = $after.StartTime.ToUniversalTime().ToString('o')
        if ($record.processStartAfter -cne $start) { throw 'PLAYER_IDENTITY_CHANGED' }
      } finally { $after.Dispose() }
    } catch { $record.error = $_.Exception.Message }
    $record.queryEndUtc = [DateTime]::UtcNow.ToString('o')
    $nextDeadline += 1.0
    while ($nextDeadline -le $clock.Elapsed.TotalSeconds) { $nextDeadline += 1.0; $record.missedDeadlines++ }
    $writer.WriteLine(($record | ConvertTo-Json -Depth 5 -Compress)); $writer.Flush()
  }
} finally { $writer.Dispose(); $player.Dispose() }
