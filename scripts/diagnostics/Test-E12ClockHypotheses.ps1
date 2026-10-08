param(
  [string]$InputPath = 'release/unity-followup-u1/host-clock-diagnostic.json',
  [string]$OutputPath = 'release/unity-followup-u1/clock-hypothesis-tests.json'
)
$ErrorActionPreference = 'Stop'
# Offline U1 diagnostic only. No provider access or host timezone selection.
if (Test-Path -LiteralPath $OutputPath) { throw 'Refusing to overwrite evidence' }
$inputHash = (Get-FileHash -LiteralPath $InputPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($inputHash -cne '155443da2c2bb91747f7a916cb82212180d999a9f2b53b330e89d428e1c0519e') {
  throw 'Unexpected historical diagnostic identity'
}
if (-not (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { throw 'ENVIRONMENT_REQUIRES_JSON_DATEKIND_STRING' }
$source = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json -DateKind String
if ($source.kind -cne 'HOST_CLOCK_DIAGNOSTIC_NOT_PLAYER' -or $source.samples.Count -ne 3) { throw 'Invalid historical diagnostic' }
$tests = [Collections.Generic.List[object]]::new()
function Check([string]$Name, [scriptblock]$Body) {
  try { & $Body; $tests.Add([ordered]@{name=$Name;status='PASS';error=$null}) }
  catch { $tests.Add([ordered]@{name=$Name;status='FAIL';error=$_.Exception.Message}) }
}
function Equal($Actual, $Expected) { if ($Actual -cne $Expected) { throw "Expected $Expected; got $Actual" } }
function Reject([scriptblock]$Body, [string]$Reason) {
  $caught = $null
  try { & $Body | Out-Null } catch { $caught = $_.Exception.Message }
  if ($null -eq $caught -or -not $caught.Contains($Reason)) { throw "Expected rejection $Reason; got $caught" }
}
function Fixture([string]$Wall) {
  return [DateTimeOffset]::Parse($Wall, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime.ToFileTimeUtc().ToString()
}
function Decode([string]$Raw, [string]$Frequency, [string]$Mode, [string]$Zone) {
  [long]$value = 0
  if ($Frequency -cne '10000000') { throw 'UNKNOWN_FREQUENCY' }
  if ($Raw -cnotmatch '^(0|[1-9][0-9]*)$' -or -not [long]::TryParse($Raw, [ref]$value) -or $value -gt 2650467743999999999) { throw 'INVALID_FILETIME' }
  $decoded = [DateTime]::FromFileTimeUtc($value)
  if ($Mode -ceq 'UTC') { return $decoded }
  if ($Mode -cne 'LOCAL_ENCODED') { throw 'UNKNOWN_MODE' }
  $rules = [TimeZoneInfo]::FindSystemTimeZoneById($Zone)
  $wall = [DateTime]::SpecifyKind($decoded, [DateTimeKind]::Unspecified)
  if ($rules.IsInvalidTime($wall)) { throw 'INVALID_LOCAL_TIME' }
  if ($rules.IsAmbiguousTime($wall)) { throw 'AMBIGUOUS_LOCAL_TIME' }
  return [TimeZoneInfo]::ConvertTimeToUtc($wall, $rules)
}
function Gate([DateTime]$Stamp, [DateTime]$Start, [DateTime]$End) {
  if ($Stamp.Kind -ne [DateTimeKind]::Utc -or $Start.Kind -ne [DateTimeKind]::Utc -or $End.Kind -ne [DateTimeKind]::Utc) { throw 'EXPECTED_UTC' }
  if ($End.Ticks -lt $Start.Ticks -or ($End.Ticks-$Start.Ticks) -gt 20000000) { return 'QUERY_WINDOW_INVALID' }
  if ($Stamp.Ticks -lt $Start.Ticks-20000000) { return 'STALE' }
  if ($Stamp.Ticks -gt $End.Ticks+2500000) { return 'FUTURE' }
  return 'HYPOTHESIS_WINDOW_MATCH'
}
function Utc([string]$Value) {
  if ($Value -cnotmatch 'Z$') { throw 'EXPECTED_EXPLICIT_UTC_STRING' }
  return [DateTimeOffset]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime
}

Check 'Historical JSON retains Z and 100ns digits' { Equal $source.samples[0].queryStartUtc '2026-10-08T08:13:05.1750759Z'; Equal (Utc $source.samples[0].queryStartUtc).ToString('o') '2026-10-08T08:13:05.1750759Z' }
Check 'UTC parsing rejects implicit wall string' { Reject { Utc '10/08/2026 08:13:05' } 'EXPECTED_EXPLICIT_UTC_STRING' }

Check 'UTC preserves 100ns precision' { Equal (Decode '134359207878597637' '10000000' 'UTC' '').ToString('o') '2026-10-08T08:13:07.8597637Z' }
Check 'Taipei local wall converts by explicit rules' { Equal (Decode (Fixture '2026-10-08T16:00:00Z') '10000000' 'LOCAL_ENCODED' 'Taipei Standard Time').ToString('o') '2026-10-08T08:00:00.0000000Z' }
Check 'Kolkata non-integer offset' { Equal (Decode (Fixture '2026-10-08T13:30:00Z') '10000000' 'LOCAL_ENCODED' 'India Standard Time').ToString('o') '2026-10-08T08:00:00.0000000Z' }
Check 'New York winter offset' { Equal (Decode (Fixture '2026-01-15T12:00:00Z') '10000000' 'LOCAL_ENCODED' 'Eastern Standard Time').ToString('o') '2026-01-15T17:00:00.0000000Z' }
Check 'New York summer offset' { Equal (Decode (Fixture '2026-07-15T12:00:00Z') '10000000' 'LOCAL_ENCODED' 'Eastern Standard Time').ToString('o') '2026-07-15T16:00:00.0000000Z' }
Check 'UTC zone cannot distinguish both hypotheses' { Equal (Decode (Fixture '2026-10-08T08:00:00Z') '10000000' 'UTC' '').Ticks (Decode (Fixture '2026-10-08T08:00:00Z') '10000000' 'LOCAL_ENCODED' 'UTC').Ticks }
Check 'DST repeated wall time rejects ambiguous offset' { Reject { Decode (Fixture '2026-11-01T01:30:00Z') '10000000' 'LOCAL_ENCODED' 'Eastern Standard Time' } 'AMBIGUOUS_LOCAL_TIME' }
Check 'DST skipped wall time rejects invalid time' { Reject { Decode (Fixture '2026-03-08T02:30:00Z') '10000000' 'LOCAL_ENCODED' 'Eastern Standard Time' } 'INVALID_LOCAL_TIME' }
Check 'Malformed or overflow FILETIME rejects' { foreach ($bad in @('', '-1', '1e17', '1.5', '9223372036854775808', '2650467744000000000')) { Reject { Decode $bad '10000000' 'UTC' '' } 'INVALID_FILETIME' } }
Check 'Unknown frequency rejects instead of rescaling' { Reject { Decode '0' '0' 'UTC' '' } 'UNKNOWN_FREQUENCY' }
Check 'Unknown decode mode rejects' { Reject { Decode '0' '10000000' 'GUESS' '' } 'UNKNOWN_MODE' }
$start = Utc '2026-10-08T08:00:00Z'; $end = $start.AddSeconds(2)
Check 'Exact query duration boundary matches' { Equal (Gate $start $start $end) 'HYPOTHESIS_WINDOW_MATCH' }
Check 'Query duration 100ns over rejects' { Equal (Gate $start $start $end.AddTicks(1)) 'QUERY_WINDOW_INVALID' }
Check 'Query clock retreat rejects' { Equal (Gate $start $start $start.AddTicks(-1)) 'QUERY_WINDOW_INVALID' }
Check 'Lag exact boundary matches' { Equal (Gate $start.AddSeconds(-2) $start $end) 'HYPOTHESIS_WINDOW_MATCH' }
Check 'Lag 100ns over rejects' { Equal (Gate $start.AddSeconds(-2).AddTicks(-1) $start $end) 'STALE' }
Check 'Future exact boundary matches' { Equal (Gate $end.AddMilliseconds(250) $start $end) 'HYPOTHESIS_WINDOW_MATCH' }
Check 'Future 100ns over rejects' { Equal (Gate $end.AddMilliseconds(250).AddTicks(1) $start $end) 'FUTURE' }

$observations = foreach ($sample in $source.samples) {
  $queryStart = Utc $sample.queryStartUtc; $queryEnd = Utc $sample.queryEndUtc
  foreach ($provider in @('gpu','system')) {
    $raw = $sample."${provider}TimestampSys100Ns"; $frequency = $sample."${provider}FrequencySys100Ns"
    $direct = Decode $raw $frequency 'UTC' ''
    $local = Decode $raw $frequency 'LOCAL_ENCODED' 'Taipei Standard Time'
    $directGate = Gate $direct $queryStart $queryEnd
    $localGate = Gate $local $queryStart $queryEnd
    Check "historical sample $($sample.sample)/$provider both hypotheses remain explicit" {
      Equal $directGate $(if($sample.sample -eq 1){'QUERY_WINDOW_INVALID'}else{'FUTURE'})
      Equal $localGate $(if($sample.sample -eq 1){'QUERY_WINDOW_INVALID'}else{'HYPOTHESIS_WINDOW_MATCH'})
    }
    [ordered]@{sample=$sample.sample;provider=$provider;fixtureZone='Taipei Standard Time';utcHypothesis=$direct.ToString('o');localEncodedHypothesis=$local.ToString('o');utcGate=$directGate;localGate=$localGate;providerMapping='UNPROVEN'}
  }
}
$failures = @($tests | Where-Object { $_.status -ne 'PASS' }).Count
$result = [ordered]@{kind='OFFLINE_CLOCK_HYPOTHESIS_TESTS';inputSha256=$inputHash;scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath).Hash.ToLowerInvariant();tests=@($tests.ToArray());passed=$tests.Count-$failures;failed=$failures;observations=@($observations);newProviderSamples=0;providerMapping='UNPROVEN';playerFreshness='NOT_RUN'}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output "PASS=$($result.passed) FAIL=$failures; providerMapping=UNPROVEN; newProviderSamples=0"
if ($failures -gt 0) { throw 'OFFLINE_TEST_FAILURE' }
