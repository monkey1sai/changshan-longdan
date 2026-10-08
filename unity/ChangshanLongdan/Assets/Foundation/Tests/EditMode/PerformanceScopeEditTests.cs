using System;
using System.Linq;
using Changshan.Character;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  public sealed class PerformanceScopeEditTests
  {
    [Test] public void StagesAreNestedDeterministicSubsetsOfCastleRoster()
    {
      foreach (uint seed in new uint[] { 7, 11, 23 })
      {
        var full = PerformanceProbe.ProbeSpawns(300, seed);
        foreach (int count in new[] { 20, 50, 100, 200, 300 })
        {
          var part = PerformanceProbe.ProbeSpawns(count, seed);
          Assert.That(part.Count, Is.EqualTo(count));
          Assert.That(part.Select(s => (s.X, s.Z, s.Yaw, s.Kind)), Is.EqualTo(full.Take(count).Select(s => (s.X, s.Z, s.Yaw, s.Kind))));
        }
      }
    }
    [Test] public void DifferentSeedsProduceDifferentInitialPositions()
    {
      var a = PerformanceProbe.ProbeSpawns(20, 7); var b = PerformanceProbe.ProbeSpawns(20, 11);
      Assert.That(a.Select(s => (s.X, s.Z)), Is.Not.EqualTo(b.Select(s => (s.X, s.Z))));
    }
    [Test] public void UnsupportedPopulationIsRejected()
    {
      foreach (int count in new[] { -1, 0, 19, 21, 301 })
        Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceProbe.ProbeSpawns(count, 7));
    }
    [Test] public void UnsupportedSeedIsRejected()
    {
      Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceProbe.ProbeSpawns(20, 0));
      Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceProbe.ProbeSpawns(20, 8));
    }
  }
}
