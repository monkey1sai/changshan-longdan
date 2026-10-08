param([string]$OutputPath = 'release/unity-followup-u1/native-clock-comparison.json')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'release/unity-followup-u1'))
$destination = [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
if (-not $destination.StartsWith($evidenceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output outside diagnostic evidence root' }
if (Test-Path -LiteralPath $destination) { throw 'Refusing existing evidence' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($destination)))) { throw 'Missing evidence directory' }
# Diagnostic interop only; values of Dedicated Usage are never returned or saved.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace E12ClockComparison {
  [StructLayout(LayoutKind.Sequential)] public struct FileTime { public uint Low, High; }
  [StructLayout(LayoutKind.Sequential, Pack=8)] public struct RawCounter {
    public uint CStatus; public FileTime TimeStamp; public long FirstValue, SecondValue; public uint MultiCount;
  }
  public sealed class CounterClock {
    public string Stage; public uint ApiStatus, CStatus, CounterType; public string TimeStamp;
  }
  public static class Native {
    [DllImport("kernel32.dll", ExactSpelling=true)] static extern void GetSystemTimePreciseAsFileTime(out FileTime time);
    [DllImport("pdh.dll", CharSet=CharSet.Unicode, ExactSpelling=true)] static extern uint PdhOpenQueryW(string source, UIntPtr user, out IntPtr query);
    [DllImport("pdh.dll", CharSet=CharSet.Unicode, ExactSpelling=true)] static extern uint PdhAddEnglishCounterW(IntPtr query, string path, UIntPtr user, out IntPtr counter);
    [DllImport("pdh.dll", ExactSpelling=true)] static extern uint PdhCollectQueryData(IntPtr query);
    [DllImport("pdh.dll", ExactSpelling=true)] static extern uint PdhGetRawCounterValue(IntPtr counter, out uint type, out RawCounter raw);
    [DllImport("pdh.dll", ExactSpelling=true)] static extern uint PdhCloseQuery(IntPtr query);
    static string Bits(FileTime time) { return (((ulong)time.High << 32) | time.Low).ToString(System.Globalization.CultureInfo.InvariantCulture); }
    public static string UtcFileTime() { FileTime time; GetSystemTimePreciseAsFileTime(out time); return Bits(time); }
    public static void CheckLayout() {
      if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(RawCounter)) != 40 || Marshal.OffsetOf(typeof(RawCounter), "CStatus").ToInt32() != 0 || Marshal.OffsetOf(typeof(RawCounter), "TimeStamp").ToInt32() != 4 || Marshal.OffsetOf(typeof(RawCounter), "FirstValue").ToInt32() != 16 || Marshal.OffsetOf(typeof(RawCounter), "SecondValue").ToInt32() != 24 || Marshal.OffsetOf(typeof(RawCounter), "MultiCount").ToInt32() != 32)
        throw new InvalidOperationException("Unexpected PDH_RAW_COUNTER ABI");
    }
    public static CounterClock Read(string path) {
      IntPtr query = IntPtr.Zero, counter; var result = new CounterClock();
      try {
        result.Stage = "Open"; result.ApiStatus = PdhOpenQueryW(null, UIntPtr.Zero, out query); if (result.ApiStatus != 0) return result;
        result.Stage = "AddEnglish"; result.ApiStatus = PdhAddEnglishCounterW(query, path, UIntPtr.Zero, out counter); if (result.ApiStatus != 0) return result;
        result.Stage = "Collect"; result.ApiStatus = PdhCollectQueryData(query); if (result.ApiStatus != 0) return result;
        uint type; RawCounter raw;
        result.Stage = "Raw"; result.ApiStatus = PdhGetRawCounterValue(counter, out type, out raw);
        result.CStatus = raw.CStatus; result.CounterType = type;
        if (result.ApiStatus == 0) result.TimeStamp = Bits(raw.TimeStamp);
        return result;
      } finally { if (query != IntPtr.Zero) PdhCloseQuery(query); }
    }
  }
}
'@
[E12ClockComparison.Native]::CheckLayout()
$rules = [TimeZoneInfo]::Local
function Hypotheses([string]$Raw) {
  $direct = [DateTime]::FromFileTimeUtc([long]$Raw)
  $wall = [DateTime]::SpecifyKind($direct, [DateTimeKind]::Unspecified)
  $local = $null; $reason = $null; $offset = $null
  if ($rules.IsInvalidTime($wall)) { $reason='INVALID_LOCAL_TIME' }
  elseif ($rules.IsAmbiguousTime($wall)) { $reason='AMBIGUOUS_LOCAL_TIME' }
  else { $local=[TimeZoneInfo]::ConvertTimeToUtc($wall,$rules).ToString('o'); $offset=$rules.GetUtcOffset($wall).TotalMinutes }
  return [ordered]@{raw=$Raw;utcHypothesis=$direct.ToString('o');localEncodedHypothesis=$local;localOffsetMinutes=$offset;localError=$reason}
}
$selectedInstance = $null
$rows = for ($window=1; $window -le 3; $window++) {
  $row = [ordered]@{window=$window;queryStartUtc=[DateTime]::UtcNow.ToString('o');nativeStartFileTime=[E12ClockComparison.Native]::UtcFileTime();nativeEndFileTime=$null;queryEndUtc=$null;instance=$selectedInstance;wmiStartFileTime=$null;wmiEndFileTime=$null;pdhStartFileTime=$null;pdhEndFileTime=$null;wmi=$null;pdh=$null;error=$null}
  try {
    $query = @{ClassName='Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory';Property=@('Name','Timestamp_Sys100NS','Timestamp_PerfTime','Frequency_Sys100NS','Frequency_PerfTime');ErrorAction='Stop'}
    if ($null -ne $selectedInstance) { $query.Filter="Name = '$selectedInstance'" }
    $row.wmiStartFileTime=[E12ClockComparison.Native]::UtcFileTime()
    try { $instance = Get-CimInstance @query | Select-Object -First 1 }
    finally { $row.wmiEndFileTime=[E12ClockComparison.Native]::UtcFileTime() }
    if ($null -eq $instance) { throw 'Selected instance unavailable' }
    if ($null -eq $selectedInstance) {
      if ($instance.Name -cnotmatch '^pid_[0-9]+_luid_0x[0-9A-Fa-f]+_0x[0-9A-Fa-f]+_phys_[0-9]+$') { throw 'Unexpected instance identity format' }
      $selectedInstance=$instance.Name
    }
    if ($instance.Name -cne $selectedInstance) { throw 'Instance identity mismatch' }
    $row.instance=$selectedInstance
    $row.wmi=[ordered]@{clock=(Hypotheses $instance.Timestamp_Sys100NS.ToString());frequencySys100Ns=$instance.Frequency_Sys100NS.ToString();timestampPerfTime=$instance.Timestamp_PerfTime.ToString();frequencyPerfTime=$instance.Frequency_PerfTime.ToString()}
    $row.pdhStartFileTime=[E12ClockComparison.Native]::UtcFileTime()
    try { $counter = [E12ClockComparison.Native]::Read("\GPU Process Memory($selectedInstance)\Dedicated Usage") }
    finally { $row.pdhEndFileTime=[E12ClockComparison.Native]::UtcFileTime() }
    $clock = $null
    if ($counter.ApiStatus -eq 0 -and $counter.CStatus -in @(0,1) -and $counter.TimeStamp) { $clock=Hypotheses $counter.TimeStamp }
    $row.pdh=[ordered]@{stage=$counter.Stage;apiStatus=$counter.ApiStatus.ToString();counterStatus=$counter.CStatus.ToString();counterType=$counter.CounterType.ToString();clock=$clock}
  } catch { $row.error=$_.Exception.Message }
  $row.nativeEndFileTime=[E12ClockComparison.Native]::UtcFileTime()
  $row.queryEndUtc=[DateTime]::UtcNow.ToString('o')
  $row
}
$result = [ordered]@{kind='NATIVE_CLOCK_COMPARISON_NOT_PLAYER';maximumWindows=3;timezoneId=$rules.Id;scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath).Hash.ToLowerInvariant();samples=@($rows);providerMapping='UNPROVEN';playerFreshness='NOT_RUN'}
$stream=[IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($result | ConvertTo-Json -Depth 9)); $stream.Write($bytes,0,$bytes.Length) }
finally { $stream.Dispose() }
Write-Output "Saved exactly 3 windows to $destination; no memory values saved"
