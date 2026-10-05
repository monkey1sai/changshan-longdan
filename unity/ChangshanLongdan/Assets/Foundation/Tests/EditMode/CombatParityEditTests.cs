using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E04: the C# port replayed against traces of the unmodified Web code (TestData/combat/web-parity.json).
  public sealed class CombatParityEditTests
  {
    static readonly double[] Rates = { 30, 60, 120 };
    static string root;
    static Dictionary<string, object> fixture;

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = CombatParity.Load(root);
      }
    }

    static void AssertClean(CombatParity.Result result, int minimumFrames = 0)
    {
      TestContext.WriteLine(result.ToString());
      Assert.That(result.FailCount, Is.Zero, result.ToString());
      Assert.That(result.Frames, Is.GreaterThanOrEqualTo(minimumFrames));
    }

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      AssertClean(CombatParity.CompareSources(Fixture, root));
    }

    [Test] public void ArenaLayoutMatchesWeb() => AssertClean(CombatParity.CompareConstants(Fixture));

    [Test] public void AllSeventeenMovesMatchWebData()
    {
      Assert.That(Moves.All.Count, Is.EqualTo(17));
      AssertClean(CombatParity.CompareMoves(Fixture));
    }

    [TestCase(30), TestCase(60), TestCase(120)]
    public void PlayerTracesMatchWeb(double hz)
    {
      var all = new CombatParity.Result();
      var traces = CombatParity.PlayerTraces(Fixture, hz).ToList();
      Assert.That(traces, Has.Count.GreaterThanOrEqualTo(20));
      foreach (var trace in traces) all.Merge((string)trace["id"], CombatParity.ReplayPlayer(trace));
      AssertClean(all, minimumFrames: (int)(hz * 30));
    }

    [Test] public void InputTracesMatchWeb()
    {
      var all = new CombatParity.Result();
      foreach (var trace in CombatParity.InputTraces(Fixture)) all.Merge((string)trace["id"], CombatParity.ReplayInput(trace, CombatParity.ComposeYaws(Fixture)));
      AssertClean(all, minimumFrames: 1000);
    }

    [Test] public void EveryMoveIsReachedAtEveryRate()
    {
      var expected = Enum.GetNames(typeof(MoveId)).OrderBy(n => n, StringComparer.Ordinal).ToArray();
      foreach (double hz in Rates)
      {
        var started = CombatParity.PlayerTraces(Fixture, hz).SelectMany(t => CombatParity.MoveStarts(t)).Select(s => s.Id).Distinct()
          .OrderBy(n => n, StringComparer.Ordinal).ToArray();
        Assert.That(started, Is.EqualTo(expected), $"{hz} Hz");
      }
    }

    // Different frame rates must take the same route. Times are compared by event time, not frame index: each move
    // start can be late by one coarse (30 Hz) frame for the press and one for the threshold it waits on, per link.
    [Test] public void RoutesAgreeAcrossRatesWithinDeclaredSampling()
    {
      const double coarseFrame = 1.0 / 30;
      foreach (var reference in CombatParity.PlayerTraces(Fixture, 120))
      {
        string id = (string)reference["id"];
        var expected = CombatParity.MoveStarts(reference);
        foreach (double hz in new double[] { 30, 60 })
        {
          var trace = CombatParity.PlayerTraces(Fixture, hz).Single(t => (string)t["id"] == id);
          var actual = CombatParity.MoveStarts(trace);
          Assert.That(actual.Select(s => s.Id), Is.EqualTo(expected.Select(s => s.Id)), $"{id} route at {hz} Hz");
          for (int k = 0; k < expected.Count; k++)
            Assert.That(Math.Abs(actual[k].Time - expected[k].Time), Is.LessThanOrEqualTo(2 * (k + 1) * coarseFrame + 1e-9),
              $"{id} start {k} ({expected[k].Id}) at {hz} Hz");
        }
      }
    }

    // Negative: a 50 ms shorter buffer must be caught by the 450 ms buffer edge scenarios.
    [Test] public void ChangedInputBufferIsDetected()
    {
      var drift = new CombatParity.Result();
      foreach (var trace in CombatParity.PlayerTraces(Fixture, 60))
        drift.Merge((string)trace["id"], CombatParity.ReplayPlayer(trace, new PlayerTuning(inputBuffer: 0.40)));
      Assert.That(drift.FailCount, Is.GreaterThan(0));
      Assert.That(drift.Mismatches.Any(m => m.StartsWith("buffer_kept_within_450ms", StringComparison.Ordinal)), Is.True, drift.ToString());
    }
  }
}
