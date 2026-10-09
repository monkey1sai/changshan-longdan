param([string]$OutputPath = 'release/unity-followup-u1/native-clock-comparison.json',
  [switch]$PlayerMetadataOnly, [string]$SourceHead, [string]$RunId)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot $(if ($PlayerMetadataOnly) { 'release/e12' } else { 'release/unity-followup-u1' })))
$destination = [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
if (-not $destination.StartsWith($evidenceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output outside diagnostic evidence root' }
if (Test-Path -LiteralPath $destination) { throw 'Refusing existing evidence' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($destination)))) { throw 'Missing evidence directory' }
if ($PlayerMetadataOnly) {
  # A separate metadata gate: no Player, GPU instances, PDH, UTC interop, or retry occurs here.
  if ($SourceHead -cnotmatch '^[a-f0-9]{40}$' -or $RunId -cnotmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') { throw 'METADATA_IDENTITY_REQUIRED' }
  if (@(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($destination)) -Force).Count -ne 0) { throw 'METADATA_DIRECTORY_NOT_EMPTY' }
  $cursor = [IO.Path]::GetDirectoryName($destination)
  while ($cursor.Length -ge $repoRoot.Length) {
    if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'UNSAFE_METADATA_PATH' }
    if ($cursor -ceq $repoRoot) { break }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  $record = [ordered]@{ schemaVersion=1; kind='PLAYER_CLOCK_METADATA_ONLY'; runId=$RunId; sourceHead=$SourceHead;
    scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();
    startUtc=[DateTime]::UtcNow.ToString('o'); endUtc=$null; maximumCimQueries=4; counterWindows=0;
    queries=@(); wmiBridgeIdentity=$null; counterSchemaIdentity=$null; environmentVersions=$null;
    gpuCounterProducerBinding=$null; clockMapping='UNVERIFIED'; status='RUNNING'; error=$null }
  $overall = [Diagnostics.Stopwatch]::StartNew()
  function Save-MetadataJson([string]$Path, $Value) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 16)); $stream.Write($bytes,0,$bytes.Length) }
    finally { $stream.Dispose() }
  }
  function Read-Metadata([string]$Name, [scriptblock]$Read) {
    if ($overall.Elapsed.TotalSeconds -ge 20) { throw 'METADATA_TOTAL_DEADLINE' }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $entry = [ordered]@{name=$Name;startTick=$overall.ElapsedTicks.ToString();frequency=[Diagnostics.Stopwatch]::Frequency.ToString();endTick=$null;elapsedMs=$null;result=$null;error=$null}
    try { $entry.result = @(& $Read) } catch { $entry.error=$_.Exception.Message }
    $entry.endTick=$overall.ElapsedTicks.ToString(); $entry.elapsedMs=$watch.Elapsed.TotalMilliseconds
    if ($entry.elapsedMs -gt 2000 -and -not $entry.error) { $entry.error='METADATA_SOURCE_DEADLINE' }
    $record.queries += ,$entry
    Save-MetadataJson (Join-Path ([IO.Path]::GetDirectoryName($destination)) ('metadata-step-{0:d2}.json' -f $record.queries.Count)) $entry
    if ($entry.error) { throw $entry.error }
    return ,$entry.result
  }
  function File-Identity([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $item.VersionInfo.FileVersion) { throw 'INVALID_SYSTEM_MODULE_IDENTITY' }
    return [ordered]@{path=$item.FullName;fileVersion=$item.VersionInfo.FileVersion;sha256=(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
  }
  try {
    if (-not [Environment]::Is64BitProcess) { throw 'METADATA_REQUIRES_64BIT' }
    $os = Read-Metadata 'OS' { Get-CimInstance -Namespace root/cimv2 -ClassName Win32_OperatingSystem -Property Version,BuildNumber -OperationTimeoutSec 2 | Select-Object Version,BuildNumber }
    if ($os.Count -ne 1 -or -not $os[0].Version -or -not $os[0].BuildNumber) { throw 'OS_IDENTITY_UNKNOWN' }
    $drivers = Read-Metadata 'GPU_DRIVERS' { Get-CimInstance -Namespace root/cimv2 -ClassName Win32_VideoController -Property Name,DriverVersion,PNPDeviceID -OperationTimeoutSec 2 | Select-Object Name,DriverVersion,PNPDeviceID }
    if ($drivers.Count -eq 0 -or @($drivers | Where-Object { -not $_.Name -or -not $_.DriverVersion -or -not $_.PNPDeviceID }).Count) { throw 'GPU_DRIVER_IDENTITY_UNKNOWN' }
    $schema = Read-Metadata 'GPU_COUNTER_CLASS' {
      $class = Get-CimClass -Namespace root/cimv2 -ClassName Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory -OperationTimeoutSec 2
      [ordered]@{name=$class.CimClassName;qualifiers=@($class.CimClassQualifiers | ForEach-Object { [ordered]@{name=$_.Name;value=$_.Value} });
        properties=@($class.CimClassProperties | ForEach-Object { [ordered]@{name=$_.Name;type=$_.CimType.ToString();qualifiers=@($_.Qualifiers | ForEach-Object { [ordered]@{name=$_.Name;value=$_.Value} })} })}
    }
    if ($schema.Count -ne 1) { throw 'COUNTER_SCHEMA_UNKNOWN' }
    $record.counterSchemaIdentity=$schema[0]
    $providerQualifier=@($schema[0].qualifiers | Where-Object { $_.name -ieq 'provider' })
    if ($providerQualifier.Count -ne 1 -or $providerQualifier[0].value -cne 'WmiPerfInst') { throw 'UNSUPPORTED_WMI_BRIDGE' }
    $provider = Read-Metadata 'WMI_BRIDGE_REGISTRATION' { Get-CimInstance -Namespace root/cimv2 -ClassName __Win32Provider -Filter "Name='WmiPerfInst'" -Property Name,CLSID -OperationTimeoutSec 2 | Select-Object Name,CLSID }
    [Guid]$clsid=[Guid]::Empty
    if ($provider.Count -ne 1 -or $provider[0].Name -cne 'WmiPerfInst' -or -not [Guid]::TryParse($provider[0].CLSID,[ref]$clsid) -or $clsid -eq [Guid]::Empty) { throw 'WMI_BRIDGE_REGISTRATION_UNKNOWN' }
    $registration = Read-Metadata 'WMI_BRIDGE_INPROC_REGISTRY64' {
      $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::Registry64)
      try {
        $key=$hive.OpenSubKey(('SOFTWARE\Classes\CLSID\'+$clsid.ToString('B')+'\InprocServer32'),$false)
        if ($null -eq $key) { throw 'WMI_BRIDGE_INPROC_UNKNOWN' }
        try { [string]$value=$key.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames); $value }
        finally { $key.Dispose() }
      } finally { $hive.Dispose() }
    }
    $system=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)
    $bridgePath=Join-Path $system 'wbem\WmiPerfInst.dll'
    if ($registration.Count -ne 1 -or [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($registration[0])) -ine [IO.Path]::GetFullPath($bridgePath)) { throw 'UNSUPPORTED_WMI_BRIDGE_PATH' }
    $files = Read-Metadata 'FIXED_SYSTEM_FILES' { File-Identity $bridgePath; File-Identity (Join-Path $system 'pdh.dll'); File-Identity (Join-Path $system 'drivers\dxgkrnl.sys') }
    if ($files.Count -ne 3) { throw 'SYSTEM_MODULE_IDENTITY_UNKNOWN' }
    $record.wmiBridgeIdentity=[ordered]@{name=$provider[0].Name;clsid=$clsid.ToString('B');registeredDll=$files[0];loadedModuleProven=$false}
    $record.environmentVersions=[ordered]@{os=$os[0];gpuDrivers=$drivers;pdh=$files[1];graphicsKernel=$files[2];timezoneId=[TimeZoneInfo]::Local.Id}
    # Registration is not loaded-module proof, and generic bridge identity is not the GPU producer binding.
    $record.status='METADATA_OBSERVED_CLOCK_MAPPING_BLOCKED'
    $record.error='GPU_COUNTER_PRODUCER_BINDING_UNPROVEN'
  } catch { $record.status='BLOCKED_METADATA'; $record.error=$_.Exception.Message }
  $record.endUtc=[DateTime]::UtcNow.ToString('o')
  Save-MetadataJson $destination $record
  Write-Output ('Saved metadata only; status='+$record.status+'; counter windows=0')
  exit 2
}
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
