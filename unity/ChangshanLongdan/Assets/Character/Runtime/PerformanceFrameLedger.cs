using System;
using System.Collections.Generic;

namespace Changshan.Character
{
  // Pure evidence validation only. No callback, provider, timing join or runtime clock mapping.
  public sealed class PerformanceFrameLedger
  {
    public enum Phase { Warmup, Measure, Drain }
    public enum IntervalStatus { Valid, Missing, Ambiguous, Invalid }

    public readonly struct UtcAnchor
    {
      public readonly long UtcTicks, BeforeTick, AfterTick, PrecisionTicks;
      public UtcAnchor(long utcTicks, long beforeTick, long afterTick, long precisionTicks)
      { UtcTicks = utcTicks; BeforeTick = beforeTick; AfterTick = afterTick; PrecisionTicks = precisionTicks; }
    }

    // Value input and immutable strings: neither the caller nor a later callback can rewrite a saved row.
    public readonly struct Frame
    {
      public readonly string RunId, ClockDomain;
      public readonly int CameraId;
      public readonly long Sequence;
      public readonly int? FrameCount;
      public readonly long? Frequency, UpdateTick, RenderBeginTick, RenderEndTick, WallEndTick;
      public readonly double? GameplayDt;
      public readonly UtcAnchor? BeginUtc, EndUtc;
      public Frame(string runId, int cameraId, long sequence, int? frameCount, string clockDomain,
        long? frequency, long? updateTick, long? renderBeginTick, long? renderEndTick, long? wallEndTick,
        double? gameplayDt, UtcAnchor? beginUtc, UtcAnchor? endUtc)
      {
        RunId = runId; CameraId = cameraId; Sequence = sequence; FrameCount = frameCount;
        ClockDomain = clockDomain; Frequency = frequency; UpdateTick = updateTick;
        RenderBeginTick = renderBeginTick; RenderEndTick = renderEndTick; WallEndTick = wallEndTick;
        GameplayDt = gameplayDt; BeginUtc = beginUtc; EndUtc = endUtc;
      }
    }

    public sealed class Row
    {
      public Frame Raw { get; }
      public bool StructurallyValid { get; }
      public IReadOnlyList<string> Reasons { get; }
      public Phase? SourcePhase { get; }
      public IntervalStatus WallStatus { get; }
      public long? WallTicks { get; }
      // Even a valid wall interval has no joined CPU/GPU, visibility or foreground evidence yet.
      public bool FormalSourcesComplete => false;
      internal Row(Frame raw, bool valid, List<string> reasons, Phase? phase, IntervalStatus wallStatus, long? wallTicks)
      { Raw = raw; StructurallyValid = valid; Reasons = Array.AsReadOnly(reasons.ToArray());
        SourcePhase = phase; WallStatus = wallStatus; WallTicks = wallTicks; }
    }

    readonly string runId, clockDomain;
    readonly int cameraId;
    readonly long frequency, warmupStart, measureStart, drainStart;
    readonly Row[] rows;
    public int Count { get; private set; }
    public long RejectedCount { get; private set; }
    public bool RejectedCountSaturated { get; private set; }
    public Frame? FirstRejected { get; private set; }
    public bool Overflowed => FirstRejected.HasValue;
    public bool StructurallyValid
    {
      get { if (Count == 0 || Overflowed) return false;
        for (int i = 0; i < Count; i++) if (!rows[i].StructurallyValid) return false;
        return true; }
    }
    public bool FormalSummaryAllowed => false;

    public PerformanceFrameLedger(string runId, int cameraId, string clockDomain, long frequency,
      long warmupStart, long measureStart, long drainStart, int capacity)
    {
      if (!Guid.TryParse(runId, out _) || cameraId == 0 || string.IsNullOrWhiteSpace(clockDomain) ||
        frequency <= 0 || warmupStart < 0 || measureStart <= warmupStart || drainStart <= measureStart || capacity <= 0)
        throw new ArgumentException("INVALID_LEDGER_CONTRACT");
      this.runId = runId; this.cameraId = cameraId; this.clockDomain = clockDomain; this.frequency = frequency;
      this.warmupStart = warmupStart; this.measureStart = measureStart; this.drainStart = drainStart;
      rows = new Row[capacity];
    }

    public Row GetRow(int index)
    { if (index < 0 || index >= Count) throw new ArgumentOutOfRangeException(nameof(index)); return rows[index]; }

    Phase? PhaseAt(long? tick)
    {
      if (!tick.HasValue || tick.Value < warmupStart) return null;
      // Half-open phases: [warmupStart, measureStart), [measureStart, drainStart), [drainStart, ...).
      return tick.Value < measureStart ? Phase.Warmup : tick.Value < drainStart ? Phase.Measure : Phase.Drain;
    }

    static void ValidateAnchor(UtcAnchor? anchor, string label, List<string> reasons)
    {
      if (!anchor.HasValue) { reasons.Add(label + "_MISSING"); return; }
      var a = anchor.Value;
      if (a.UtcTicks < DateTime.MinValue.Ticks || a.UtcTicks > DateTime.MaxValue.Ticks ||
        a.BeforeTick < 0 || a.AfterTick < a.BeforeTick || a.PrecisionTicks <= 0)
        reasons.Add(label + "_INVALID");
    }

    public bool Append(Frame raw)
    {
      if (Count == rows.Length)
      {
        if (!FirstRejected.HasValue) FirstRejected = raw;
        if (RejectedCount == long.MaxValue) RejectedCountSaturated = true; else RejectedCount++;
        return false; // Bounded memory: reject rather than overwrite or create an unbounded overflow list.
      }
      var reasons = new List<string>();
      var previous = Count > 0 ? rows[Count - 1] : null;
      if (raw.RunId != runId || raw.CameraId != cameraId) reasons.Add("IDENTITY_MISMATCH");
      if (raw.ClockDomain != clockDomain || raw.Frequency != frequency) reasons.Add("CLOCK_DOMAIN_OR_FREQUENCY_MISMATCH");
      if (raw.Sequence <= 0 || (previous == null ? raw.Sequence != 1 :
        previous.Raw.Sequence == long.MaxValue || raw.Sequence != previous.Raw.Sequence + 1)) reasons.Add("SEQUENCE_DISCONTINUITY");
      if (!raw.FrameCount.HasValue) reasons.Add("FRAME_COUNT_MISSING");
      else if (raw.FrameCount.Value < 0 || (previous != null && previous.Raw.FrameCount.HasValue &&
        (previous.Raw.FrameCount.Value == int.MaxValue || raw.FrameCount.Value != previous.Raw.FrameCount.Value + 1)))
        reasons.Add("FRAME_COUNT_DISCONTINUITY");
      if (!raw.GameplayDt.HasValue) reasons.Add("GAMEPLAY_DT_MISSING");
      else if (double.IsNaN(raw.GameplayDt.Value) || double.IsInfinity(raw.GameplayDt.Value) || raw.GameplayDt.Value < 0)
        reasons.Add("GAMEPLAY_DT_INVALID");
      if (!raw.UpdateTick.HasValue || !raw.RenderBeginTick.HasValue || !raw.RenderEndTick.HasValue || !raw.WallEndTick.HasValue)
        reasons.Add("SOURCE_TICKS_MISSING");
      else if (raw.UpdateTick.Value < warmupStart || raw.RenderBeginTick.Value < raw.UpdateTick.Value ||
        raw.RenderEndTick.Value < raw.RenderBeginTick.Value || raw.WallEndTick.Value < raw.RenderEndTick.Value)
        reasons.Add("SOURCE_TICKS_INVALID");
      ValidateAnchor(raw.BeginUtc, "BEGIN_UTC", reasons); ValidateAnchor(raw.EndUtc, "END_UTC", reasons);
      if (raw.BeginUtc.HasValue && raw.EndUtc.HasValue &&
        (raw.EndUtc.Value.UtcTicks < raw.BeginUtc.Value.UtcTicks || raw.EndUtc.Value.BeforeTick < raw.BeginUtc.Value.AfterTick))
        reasons.Add("UTC_ANCHORS_RETREAT_OR_OVERLAP");
      if (previous != null && raw.BeginUtc.HasValue && previous.Raw.EndUtc.HasValue &&
        raw.BeginUtc.Value.UtcTicks < previous.Raw.EndUtc.Value.UtcTicks) reasons.Add("UTC_CLOCK_RETREAT");
      if (previous != null && raw.UpdateTick.HasValue && previous.Raw.WallEndTick.HasValue &&
        raw.UpdateTick.Value < previous.Raw.WallEndTick.Value) reasons.Add("SOURCE_CLOCK_RETREAT");
      bool valid = reasons.Count == 0;
      var phase = PhaseAt(raw.WallEndTick);
      IntervalStatus status; long? wallTicks = null;
      if (!valid) status = IntervalStatus.Invalid;
      else if (previous == null || !previous.StructurallyValid || !previous.Raw.WallEndTick.HasValue)
      { status = IntervalStatus.Missing; reasons.Add("WALL_PREDECESSOR_MISSING"); }
      else if (raw.WallEndTick.Value <= previous.Raw.WallEndTick.Value)
      { status = IntervalStatus.Invalid; reasons.Add("WALL_INTERVAL_NONPOSITIVE"); }
      else
      {
        // Both nonnegative long values are ordered; subtraction cannot overflow or lose precision.
        wallTicks = raw.WallEndTick.Value - previous.Raw.WallEndTick.Value;
        if (PhaseAt(previous.Raw.WallEndTick) != phase)
        { status = IntervalStatus.Ambiguous; reasons.Add("WALL_PHASE_BOUNDARY"); }
        else status = IntervalStatus.Valid;
      }
      rows[Count++] = new Row(raw, valid, reasons, phase, status, wallTicks);
      return true;
    }
  }
}
