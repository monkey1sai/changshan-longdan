param([Parameter(Mandatory)][int]$TargetPid, [Parameter(Mandatory)][string]$Output)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Output) { throw 'Refusing to overwrite telemetry' }
$player = Get-Process -Id $TargetPid
$start = $player.StartTime.ToUniversalTime().ToString('o')
$counterClass = Get-CimClass Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory
foreach ($name in @('DedicatedUsage','SharedUsage','TotalCommitted')) {
  if (($counterClass.CimClassProperties[$name].Qualifiers['CounterType'].Value) -ne 65792) { throw 'Unsupported GPU counter type' }
}
$clock = [Diagnostics.Stopwatch]::StartNew()
$writer = [IO.StreamWriter]::new($Output, $false, [Text.UTF8Encoding]::new($false))
try {
  while ($clock.Elapsed.TotalSeconds -lt 60) {
    $player.Refresh()
    if ($player.HasExited -or $player.StartTime.ToUniversalTime().ToString('o') -cne $start) { break }
    $record = [ordered]@{ pid = $TargetPid; processStart = $start; seconds = $clock.Elapsed.TotalSeconds; utc = [DateTime]::UtcNow.ToString('o'); queryEndUtc = $null; provider = 'Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory'; instances = $null; error = $null }
    try {
      $raw = @(Get-CimInstance Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory | Where-Object { $_.Name -like "pid_${TargetPid}_*" })
      $record.instances = @($raw | ForEach-Object { [ordered]@{ name = $_.Name; dedicatedBytes = $_.DedicatedUsage; sharedBytes = $_.SharedUsage; committedBytes = $_.TotalCommitted; counterType = 65792; timestampPerfTime = $_.Timestamp_PerfTime; frequencyPerfTime = $_.Frequency_PerfTime; timestampSys100Ns = $_.Timestamp_Sys100NS.ToString(); timestampUtc = [DateTime]::FromFileTimeUtc([long]$_.Timestamp_Sys100NS).ToString('o') } })
    } catch { $record.error = $_.Exception.Message }
    $record.queryEndUtc = [DateTime]::UtcNow.ToString('o')
    $writer.WriteLine(($record | ConvertTo-Json -Depth 5 -Compress)); $writer.Flush()
    Start-Sleep -Milliseconds 1000
  }
} finally { $writer.Dispose(); $player.Dispose() }
