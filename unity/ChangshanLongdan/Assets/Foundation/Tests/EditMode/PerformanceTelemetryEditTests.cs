using System;
using Changshan.Character;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  public sealed class PerformanceTelemetryEditTests
  {
    const string LedgerRun = "1d9e2de5-a99e-44bc-b70a-b3b0137eb0cf";
    const long UtcBase = 638000000000000000;
    static PerformanceFrameLedger Ledger(int capacity = 8, long measure = 100, long drain = 200) =>
      new PerformanceFrameLedger(LedgerRun, -7, "fixture-monotonic", 1000, 0, measure, drain, capacity);
    static PerformanceFrameLedger.Frame Frame(long sequence = 1, int? frameCount = 0, long tick = 0,
      string run = LedgerRun, int camera = -7, string domain = "fixture-monotonic", long? frequency = 1000,
      double? dt = 0, bool anchors = true, int missingTick = -1, bool missingFrame = false)
    {
      long utc = UtcBase + (frameCount ?? 0);
      var anchor = new PerformanceFrameLedger.UtcAnchor(utc, tick, tick, 1);
      return new PerformanceFrameLedger.Frame(run, camera, sequence, missingFrame ? null : frameCount, domain, frequency,
        missingTick == 0 ? null : tick, missingTick == 1 ? null : tick, missingTick == 2 ? null : tick,
        missingTick == 3 ? null : tick, dt, anchors ? anchor : (PerformanceFrameLedger.UtcAnchor?)null,
        anchors ? anchor : (PerformanceFrameLedger.UtcAnchor?)null);
    }

    [Test] public void LedgerKeepsZeroValuesNegativeCameraAndIndependentFormalGates()
    {
      var ledger = Ledger();
      Assert.IsTrue(ledger.Append(Frame()));
      Assert.IsTrue(ledger.GetRow(0).StructurallyValid);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Missing, ledger.GetRow(0).WallStatus);
      ledger.Append(Frame(2, 1, 10));
      var row = ledger.GetRow(1);
      Assert.AreEqual(10, row.WallTicks);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Valid, row.WallStatus);
      Assert.IsTrue(ledger.StructurallyValid);
      Assert.IsFalse(row.FormalSourcesComplete);
      Assert.IsFalse(ledger.FormalSummaryAllowed);
    }

    [Test] public void LedgerRejectsBadContractWithoutStartingProviders()
    {
      foreach (var run in new[] { null, "", "not-a-uuid" })
        Assert.Throws<ArgumentException>(() => new PerformanceFrameLedger(run, -7, "fixture", 1, 0, 1, 2, 1));
      Assert.Throws<ArgumentException>(() => new PerformanceFrameLedger(LedgerRun, 0, "fixture", 1, 0, 1, 2, 1));
      Assert.Throws<ArgumentException>(() => new PerformanceFrameLedger(LedgerRun, -7, "", 1, 0, 1, 2, 1));
      Assert.Throws<ArgumentException>(() => new PerformanceFrameLedger(LedgerRun, -7, "fixture", 0, 0, 1, 2, 1));
      Assert.Throws<ArgumentException>(() => new PerformanceFrameLedger(LedgerRun, -7, "fixture", 1, -1, 1, 2, 1));
      Assert.Throws<ArgumentException>(() => Ledger(measure: 0));
      Assert.Throws<ArgumentException>(() => Ledger(drain: 100));
      Assert.Throws<ArgumentException>(() => Ledger(capacity: 0));
    }

    [Test] public void LedgerPreservesMissingRowsAndNeverBridgesTheirWallInterval()
    {
      for (int missing = 0; missing < 4; missing++)
      {
        var ledger = Ledger();
        ledger.Append(Frame());
        ledger.Append(Frame(2, 1, 10, missingTick: missing));
        Assert.IsFalse(ledger.GetRow(1).StructurallyValid);
        CollectionAssert.Contains(ledger.GetRow(1).Reasons, "SOURCE_TICKS_MISSING");
        ledger.Append(Frame(3, 2, 20));
        Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Missing, ledger.GetRow(2).WallStatus);
        Assert.IsNull(ledger.GetRow(2).WallTicks);
        Assert.IsFalse(ledger.StructurallyValid);
        Assert.AreEqual(3, ledger.Count);
      }
      foreach (var raw in new[] { Frame(missingFrame: true), Frame(dt: null), Frame(anchors: false), Frame(frequency: null) })
      {
        var ledger = Ledger(); ledger.Append(raw);
        Assert.IsFalse(ledger.GetRow(0).StructurallyValid);
        Assert.IsFalse(ledger.FormalSummaryAllowed);
      }
    }

    [Test] public void LedgerRetainsIdentityClockAndSequenceFailuresWithoutRenumbering()
    {
      foreach (var raw in new[] { Frame(run: "other", camera: 8, domain: "other", frequency: 1),
        Frame(sequence: 0), Frame(sequence: 2), Frame(frameCount: -1) })
      {
        var ledger = Ledger(); ledger.Append(raw);
        Assert.IsFalse(ledger.GetRow(0).StructurallyValid);
        Assert.AreEqual(raw.Sequence, ledger.GetRow(0).Raw.Sequence);
        Assert.AreEqual(raw.RunId, ledger.GetRow(0).Raw.RunId);
      }
      var failures = Ledger(); failures.Append(Frame(run: "other", camera: 8, domain: "other", frequency: 1));
      CollectionAssert.Contains(failures.GetRow(0).Reasons, "IDENTITY_MISMATCH");
      CollectionAssert.Contains(failures.GetRow(0).Reasons, "CLOCK_DOMAIN_OR_FREQUENCY_MISMATCH");
      foreach (var sequence in new long[] { 1, 0, 3 })
      {
        var ledger = Ledger(); ledger.Append(Frame()); ledger.Append(Frame(sequence, 1, 10));
        CollectionAssert.Contains(ledger.GetRow(1).Reasons, "SEQUENCE_DISCONTINUITY");
      }
      foreach (var frameCount in new[] { 0, -1, 2 })
      {
        var ledger = Ledger(); ledger.Append(Frame()); ledger.Append(Frame(2, frameCount, 10));
        CollectionAssert.Contains(ledger.GetRow(1).Reasons, "FRAME_COUNT_DISCONTINUITY");
      }
    }

    [Test] public void LedgerUsesExactIntegerBoundariesAndRejectsZeroWall()
    {
      var zero = Ledger(); zero.Append(Frame()); zero.Append(Frame(2, 1));
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Invalid, zero.GetRow(1).WallStatus);
      Assert.IsNull(zero.GetRow(1).WallTicks);
      CollectionAssert.Contains(zero.GetRow(1).Reasons, "WALL_INTERVAL_NONPOSITIVE");
      var large = Ledger(measure: long.MaxValue - 100, drain: long.MaxValue - 50);
      large.Append(Frame(tick: long.MaxValue - 2)); large.Append(Frame(2, 1, long.MaxValue - 1));
      Assert.AreEqual(1, large.GetRow(1).WallTicks);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Valid, large.GetRow(1).WallStatus);
      var count = Ledger(); count.Append(Frame(frameCount: int.MaxValue)); count.Append(Frame(2, 0, 10));
      CollectionAssert.Contains(count.GetRow(1).Reasons, "FRAME_COUNT_DISCONTINUITY");
      var sequence = Ledger(); sequence.Append(Frame(sequence: long.MaxValue)); sequence.Append(Frame(1, 1, 10));
      CollectionAssert.Contains(sequence.GetRow(1).Reasons, "SEQUENCE_DISCONTINUITY");
    }

    [Test] public void LedgerSeparatesExactPhaseBoundariesFromArrivalTime()
    {
      var ledger = Ledger();
      long[] ticks = { 99, 100, 101, 199, 200, 201 };
      for (int i = 0; i < ticks.Length; i++) ledger.Append(Frame(i + 1, i, ticks[i]));
      Assert.AreEqual(PerformanceFrameLedger.Phase.Warmup, ledger.GetRow(0).SourcePhase);
      Assert.AreEqual(PerformanceFrameLedger.Phase.Measure, ledger.GetRow(1).SourcePhase);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Ambiguous, ledger.GetRow(1).WallStatus);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Valid, ledger.GetRow(2).WallStatus);
      Assert.AreEqual(PerformanceFrameLedger.Phase.Drain, ledger.GetRow(4).SourcePhase);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Ambiguous, ledger.GetRow(4).WallStatus);
      Assert.AreEqual(PerformanceFrameLedger.IntervalStatus.Valid, ledger.GetRow(5).WallStatus);
      Assert.AreEqual(1, ledger.GetRow(4).WallTicks); // Keep the raw crossing interval; do not turn it into a measured sample.
      Assert.IsFalse(ledger.FormalSummaryAllowed);
    }

    [Test] public void LedgerValidatesAnchorBoundsButDoesNotProveClockMapping()
    {
      var good = Frame();
      foreach (var anchor in new[] {
        new PerformanceFrameLedger.UtcAnchor(-1, 0, 0, 1),
        new PerformanceFrameLedger.UtcAnchor(long.MaxValue, 0, 0, 1),
        new PerformanceFrameLedger.UtcAnchor(UtcBase, -1, 0, 1),
        new PerformanceFrameLedger.UtcAnchor(UtcBase, 2, 1, 1),
        new PerformanceFrameLedger.UtcAnchor(UtcBase, 0, 0, 0) })
      {
        var ledger = Ledger(); ledger.Append(new PerformanceFrameLedger.Frame(good.RunId, good.CameraId, 1, 0,
          good.ClockDomain, 1000, 0, 0, 0, 0, 0, anchor, good.EndUtc));
        CollectionAssert.Contains(ledger.GetRow(0).Reasons, "BEGIN_UTC_INVALID");
      }
      foreach (double dt in new[] { -1d, double.NaN, double.PositiveInfinity })
      { var ledger = Ledger(); ledger.Append(Frame(dt: dt)); CollectionAssert.Contains(ledger.GetRow(0).Reasons, "GAMEPLAY_DT_INVALID"); }
      var retreat = Ledger(); retreat.Append(Frame(tick: 10)); retreat.Append(Frame(2, 1, 9));
      CollectionAssert.Contains(retreat.GetRow(1).Reasons, "SOURCE_CLOCK_RETREAT");
      var utcRetreat = Ledger(); utcRetreat.Append(Frame(frameCount: 1)); utcRetreat.Append(Frame(2, 0, 10));
      CollectionAssert.Contains(utcRetreat.GetRow(1).Reasons, "UTC_CLOCK_RETREAT");
      var overlap = Ledger(); overlap.Append(new PerformanceFrameLedger.Frame(good.RunId, good.CameraId, 1, 0,
        good.ClockDomain, 1000, 0, 0, 0, 0, 0,
        new PerformanceFrameLedger.UtcAnchor(UtcBase, 0, 2, 1),
        new PerformanceFrameLedger.UtcAnchor(UtcBase - 1, 1, 3, 1)));
      CollectionAssert.Contains(overlap.GetRow(0).Reasons, "UTC_ANCHORS_RETREAT_OR_OVERLAP");
      var order = Ledger(); order.Append(new PerformanceFrameLedger.Frame(good.RunId, good.CameraId, 1, 0,
        good.ClockDomain, 1000, 10, 9, 11, 12, 0, good.BeginUtc, good.EndUtc));
      CollectionAssert.Contains(order.GetRow(0).Reasons, "SOURCE_TICKS_INVALID");
    }

    [Test] public void LedgerCapacityAndSavedEvidenceRemainImmutableAfterRejection()
    {
      var ledger = Ledger(capacity: 2);
      var input = Frame(); ledger.Append(input); input = Frame(run: "mutated");
      Assert.AreEqual(LedgerRun, ledger.GetRow(0).Raw.RunId);
      var reasons = (System.Collections.Generic.IList<string>)ledger.GetRow(0).Reasons;
      Assert.Throws<NotSupportedException>(() => reasons[0] = "rewritten");
      ledger.Append(Frame(2, 1, 10)); Assert.IsFalse(ledger.Overflowed);
      Assert.IsFalse(ledger.Append(Frame(3, 2, 20)));
      Assert.IsFalse(ledger.Append(Frame(4, 3, 30)));
      Assert.AreEqual(2, ledger.Count); Assert.AreEqual(2, ledger.RejectedCount);
      Assert.AreEqual(3, ledger.FirstRejected.Value.Sequence);
      Assert.AreEqual(2, ledger.GetRow(1).Raw.Sequence);
      Assert.IsTrue(ledger.Overflowed); Assert.IsFalse(ledger.StructurallyValid);
      Assert.IsFalse(ledger.FormalSummaryAllowed);
      Assert.Throws<ArgumentOutOfRangeException>(() => ledger.GetRow(2));
    }

    [Test] public void ProbeAcceptsOnlyTheApprovedAiSeeds()
    {
      foreach (uint seed in new uint[] { 7, 11, 23 })
        Assert.DoesNotThrow(() => PerformanceProbe.RequireControllerSeed(seed));
      foreach (uint seed in new uint[] { 0, 8, uint.MaxValue })
      {
        var error = Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceProbe.RequireControllerSeed(seed));
        StringAssert.Contains("UNSUPPORTED_CONTROLLER_AI_SEED", error.Message);
      }
    }
    static PerformanceProbe.CounterInfo Descriptor(string category, string unit = "Count") =>
      new PerformanceProbe.CounterInfo { name = "Draw Calls Count", category = category, unit = unit };

    [Test] public void RenderCounterSelectionIsIndependentOfCatalogOrder()
    {
      var render = Descriptor("Render");
      var ui = Descriptor("UI Toolkit");
      Assert.AreSame(render, PerformanceProbe.SelectCounterDescriptor(new[] { ui, render }, render.name));
      Assert.AreSame(render, PerformanceProbe.SelectCounterDescriptor(new[] { render, ui }, render.name));
    }

    [Test] public void MissingWrongUnitAndAmbiguousCountersRemainUnknown()
    {
      var render = Descriptor("Render");
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(Array.Empty<PerformanceProbe.CounterInfo>(), render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { Descriptor("UI Toolkit") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { Descriptor("Render", "Bytes") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render, render }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render, Descriptor("Render", "Bytes") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render }, "Unknown"));
    }

    [Test] public void CpuAndMemoryCountersUseTheirOwnCategoryAndUnit()
    {
      var cpu = new PerformanceProbe.CounterInfo { name = "CPU Main Thread Frame Time", category = "Render", unit = "TimeNanoseconds" };
      var memory = new PerformanceProbe.CounterInfo { name = "GC Used Memory", category = "Memory", unit = "Bytes" };
      Assert.AreSame(cpu, PerformanceProbe.SelectCounterDescriptor(new[] { cpu }, cpu.name));
      Assert.AreSame(memory, PerformanceProbe.SelectCounterDescriptor(new[] { memory }, memory.name));
      cpu.unit = "Count";
      memory.category = "Render";
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { cpu }, cpu.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { memory }, memory.name));
    }
  }
}
