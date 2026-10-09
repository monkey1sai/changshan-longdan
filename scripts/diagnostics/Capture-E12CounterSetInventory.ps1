[CmdletBinding(PositionalBinding=$false)]
param([Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$SourceHead, [Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference = 'Stop'
# Separate entry point: legacy metadata/registration switches are not accepted.
if ($SourceHead -cnotmatch '^[a-f0-9]{40}$' -or $RunId -cnotmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') { throw 'INVENTORY_IDENTITY_REQUIRED' }
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceRoot=[IO.Path]::GetFullPath((Join-Path $repoRoot 'release/e12'))
$destination=[IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
if (-not $destination.StartsWith($evidenceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'INVENTORY_OUTPUT_OUTSIDE_ROOT' }
$directory=[IO.Path]::GetDirectoryName($destination)
if (-not (Test-Path -LiteralPath $directory) -or @(Get-ChildItem -LiteralPath $directory -Force).Count -ne 0) { throw 'INVENTORY_REQUIRES_EMPTY_DIRECTORY' }
$cursor=$directory
while ($cursor.Length -ge $repoRoot.Length) {
  if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'UNSAFE_INVENTORY_PATH' }
  if ($cursor -ceq $repoRoot) { break }; $cursor=[IO.Path]::GetDirectoryName($cursor)
}
function Save-InventoryJson([string]$Path,$Value) {
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length) }
  finally { $stream.Dispose() }
}
$record=[ordered]@{schemaVersion=1;kind='V2_COUNTERSET_INVENTORY_ONLY';runId=$RunId;sourceHead=$SourceHead;
  scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();maximumNativeCalls=1;
  machine=$null;capacityGuids=512;counterWindows=0;playerLaunched=$false;clockMapping='UNVERIFIED';
  startUtc=[DateTime]::UtcNow.ToString('o');endUtc=$null;sourceStartTick=$null;sourceEndTick=$null;frequency=$null;
  elapsedMs=$null;deadlineExceeded=$null;raw=$null;candidateGuid='5c3b2414-fd1d-44fb-8b00-e3194209dd1a';
  candidatePresent=$null;producerImplementation=$null;status='RUNNING';error=$null}
try {
  $inputRoot=Join-Path $repoRoot 'release/e12/counter-registration-v1'
  $inputs=@(@('analysis.json','d7f33686febed2ea5defb8f71db0f97b606bdf91f739b466153f3b9871668161'),
    @('registration/registration.json','46a5cbed4d542f9ac01fd94184d33c07480a4f764e07af295ec5534f86da78c6'))
  foreach($inputFile in $inputs) {
    $inputPath=Join-Path $inputRoot $inputFile[0]
    $cursor=$inputPath
    while($cursor.Length -ge $repoRoot.Length) {
      if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'UNSAFE_INVENTORY_INPUT' }
      if($cursor -ceq $repoRoot){break};$cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    if ((Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $inputFile[1]) { throw 'INVENTORY_INPUT_HASH_MISMATCH' }
  }
  $record.inputAnalysisSha256=$inputs[0][1];$record.inputRawSha256=$inputs[1][1]
  $inventoryInterop = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
namespace E12CounterInventory {
  public sealed class Raw {
    public uint Status; public uint? ActualCount, RequiredCount; public string[] Ids;
    public string StartTick, EndTick, Frequency;
  }
  public static class Native {
    [DllImport("advapi32.dll", ExactSpelling=true, CharSet=CharSet.Unicode)]
    static extern uint PerfEnumerateCounterSet(string machine, [Out] Guid[] ids, uint capacity, out uint actual);
    public static void CheckLayout() {
      if(IntPtr.Size!=8 || Marshal.SizeOf(typeof(Guid))!=16 || Marshal.SizeOf(typeof(uint))!=4)
        throw new InvalidOperationException("INVENTORY_ABI_MISMATCH");
    }
    public static Raw Read() {
      Guid[] ids=new Guid[512]; uint actual; Raw raw=new Raw();
      raw.Frequency=Stopwatch.Frequency.ToString(CultureInfo.InvariantCulture);
      raw.StartTick=Stopwatch.GetTimestamp().ToString(CultureInfo.InvariantCulture);
      raw.Status=PerfEnumerateCounterSet(null,ids,512,out actual);
      raw.EndTick=Stopwatch.GetTimestamp().ToString(CultureInfo.InvariantCulture);
      CaptureResult(raw,ids,actual); return raw;
    }
    public static void CaptureResult(Raw raw, Guid[] ids, uint actual) {
      if(raw.Status==0) {
        raw.ActualCount=actual;
        if(ids!=null && actual<=512 && actual<=ids.Length) {
          raw.Ids=new string[actual];
          for(int i=0;i<actual;i++)raw.Ids[i]=ids[i].ToString("D");
        }
      } else if(raw.Status==8) {raw.RequiredCount=actual;}
    }
    public static void Validate(Raw raw) {
      if(raw==null || raw.Status!=0 || !raw.ActualCount.HasValue || raw.RequiredCount.HasValue ||
        raw.ActualCount.Value>512 || raw.Ids==null || raw.Ids.Length!=raw.ActualCount.Value)
        throw new InvalidDataException("INVENTORY_STATUS_OR_COUNT");
      HashSet<Guid> seen=new HashSet<Guid>();
      foreach(string text in raw.Ids) {
        Guid id;
        if(!Guid.TryParseExact(text,"D",out id) || id==Guid.Empty || id.ToString("D")!=text || !seen.Add(id))
          throw new InvalidDataException("INVENTORY_INVALID_OR_DUPLICATE_GUID");
      }
    }
    public static decimal DurationMs(long start,long end,long frequency) {
      if(start<0 || end<start || frequency<=0)throw new InvalidDataException("INVENTORY_INVALID_TICKS");
      return ((decimal)end-start)*1000m/frequency;
    }
  }
}
'@
  Add-Type -TypeDefinition $inventoryInterop
  [E12CounterInventory.Native]::CheckLayout()
  # INVENTORY_CALL_BEGIN: exactly one native call, even on malformed or late output.
  $record.frequency=[Diagnostics.Stopwatch]::Frequency.ToString()
  $record.sourceStartTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString()
  try {
    $record.raw=[E12CounterInventory.Native]::Read()
    [E12CounterInventory.Native]::Validate($record.raw)
    $record.candidatePresent=$record.raw.Ids -ccontains $record.candidateGuid
  } catch { $record.error=$_.Exception.Message }
  $record.sourceEndTick=[Diagnostics.Stopwatch]::GetTimestamp().ToString()
  $record.elapsedMs=[E12CounterInventory.Native]::DurationMs([long]$record.sourceStartTick,[long]$record.sourceEndTick,[long]$record.frequency)
  $record.deadlineExceeded=$record.elapsedMs -gt 2000
  if($record.deadlineExceeded) { $record.candidatePresent=$null;if(-not $record.error){$record.error='INVENTORY_SOURCE_DEADLINE'} }
  Save-InventoryJson (Join-Path $directory 'inventory-step-01.json') $record
  if($record.error) {throw $record.error}
  # INVENTORY_CALL_END: inventory is not a name/provider/clock binding.
  $record.status='V2_COUNTERSET_INVENTORY_OBSERVED_CLOCK_BLOCKED'
  $record.error='COUNTER_NAME_PROVIDER_AND_CLOCK_UNPROVEN'
} catch { $record.status='BLOCKED_INVENTORY';$record.error=$_.Exception.Message }
$record.endUtc=[DateTime]::UtcNow.ToString('o')
Save-InventoryJson $destination $record
Write-Output ('Saved V2 inventory only; status='+$record.status+'; counter windows=0')
exit 2
