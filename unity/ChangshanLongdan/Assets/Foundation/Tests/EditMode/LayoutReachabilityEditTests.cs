using System;
using System.Collections.Generic;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  // E11: collision-only reachability. This does not prove that moving enemy crowds cannot surround the player.
  public sealed class LayoutReachabilityEditTests
  {
    static double Clearance(double x, double z, double limit, IReadOnlyList<Rect> obstacles)
    {
      double clearance = Math.Min(limit - Math.Abs(x), limit - Math.Abs(z));
      foreach (var o in obstacles)
      {
        double dx = Math.Max(Math.Max(o.MinX - x, 0), x - o.MaxX);
        double dz = Math.Max(Math.Max(o.MinZ - z, 0), z - o.MaxZ);
        clearance = Math.Min(clearance, Math.Sqrt(dx * dx + dz * dz));
      }
      return clearance;
    }

    sealed class Grid
    {
      readonly double limit, step, reserve;
      readonly int size;
      readonly double[] clearance;
      public double Reserve => reserve;
      public Grid(double limit, IReadOnlyList<Rect> obstacles, double step = 0.25)
      {
        this.limit = limit; this.step = step; reserve = step / Math.Sqrt(2);
        size = (int)Math.Round(2 * limit / step) + 1;
        clearance = new double[size * size];
        for (int z = 0; z < size; z++)
          for (int x = 0; x < size; x++) clearance[z * size + x] = Clearance(-limit + x * step, -limit + z * step, limit, obstacles);
      }
      int Index(CastleLayout.Centre p)
      {
        if (Math.Abs(p.X) > limit || Math.Abs(p.Z) > limit) return -1;
        // JS Math.round is floor(x + 0.5); array coordinates are nonnegative.
        return (int)Math.Floor((p.Z + limit) / step + 0.5) * size + (int)Math.Floor((p.X + limit) / step + 0.5);
      }
      public bool[] Reaches(CastleLayout.Centre start, IReadOnlyList<CastleLayout.Centre> goals, double radius)
      {
        double threshold = radius + reserve;
        int first = Index(start), head = 0, tail = 0;
        var visited = new bool[clearance.Length];
        var queue = new int[clearance.Length];
        if (first >= 0 && clearance[first] >= threshold) { visited[first] = true; queue[tail++] = first; }
        void Visit(int at)
        {
          if (at < 0 || at >= visited.Length || visited[at] || clearance[at] < threshold) return;
          visited[at] = true; queue[tail++] = at;
        }
        while (head < tail)
        {
          int at = queue[head++], x = at % size;
          if (x > 0) Visit(at - 1);
          if (x < size - 1) Visit(at + 1);
          Visit(at - size); Visit(at + size);
        }
        return goals.Select(p => { int at = Index(p); return at >= 0 && visited[at]; }).ToArray();
      }
      public double CommonPathWidth(CastleLayout.Centre start, IReadOnlyList<CastleLayout.Centre> goals, double radius)
      {
        if (!Reaches(start, goals, radius).All(v => v)) return 0;
        double low = radius, high = 4;
        for (int i = 0; i < 12; i++)
        {
          double mid = (low + high) / 2;
          if (Reaches(start, goals, mid).All(v => v)) low = mid;
          else high = mid;
        }
        return 2 * low;
      }
    }

    static Rect[] Gap(double width) => new[] { new Rect(-3, -width / 2, -0.25, 0.25), new Rect(width / 2, 3, -0.25, 0.25) };
    static CastleLayout.Centre Point(double x, double z) => new CastleLayout.Centre(x, z);

    [Test] public void AllSquadCentresAndSeedSevenCaptainsHaveFullDiameterRoutes()
    {
      double radius = PlayerTuning.Default.BodyRadius;
      Assert.That(radius, Is.EqualTo(0.45));
      var captains = CastleLayout.Spawns().Where(p => p.Kind == EnemyKind.Captain).Select(p => Point(p.X, p.Z)).ToArray();
      Assert.That(CastleLayout.Squads.Count, Is.EqualTo(25));
      Assert.That(captains.Length, Is.EqualTo(9));
      var goals = CastleLayout.Squads.Concat(captains).ToArray();
      var start = Point(ArenaLayout.StartX, ArenaLayout.StartZ);
      var grid = new Grid(ArenaLayout.PlayLimit, ArenaLayout.Obstacles());
      Assert.That(grid.Reaches(start, goals, radius), Is.All.True);
      double width = grid.CommonPathWidth(start, goals, radius);
      Assert.That(width, Is.GreaterThanOrEqualTo(2 * radius));
      // Same independently computed lower bound as the Web grid; neither changes collision or runtime layout.
      Assert.That(width, Is.EqualTo(5.646044921875).Within(1e-9));
      TestContext.WriteLine($"e11-layout/v1 targets={goals.Length} radius={radius:R} gridStep=0.25 connectorReserve={grid.Reserve:R} commonPathWidthLowerBound={width:R}");
    }

    [Test] public void BlockedPassageFailsAndWidePassageIsReachable()
    {
      double radius = PlayerTuning.Default.BodyRadius;
      var start = Point(0, -2); var goals = new[] { Point(0, 2) };
      Assert.That(new Grid(3, Gap(0.89)).Reaches(start, goals, radius), Is.EqualTo(new[] { false }));
      Assert.That(new Grid(3, Gap(1.5)).Reaches(start, goals, radius), Is.EqualTo(new[] { true }));
      Assert.That(new Grid(3, Gap(0.89)).CommonPathWidth(start, goals, radius), Is.Zero);
    }

    [Test] public void ExactDiameterIsAnalyticalAndSamplingReserveIsPreserved()
    {
      double radius = PlayerTuning.Default.BodyRadius;
      Assert.That(Clearance(0, 0, 3, Gap(0.9)), Is.EqualTo(radius));
      Assert.That(Clearance(0, 0, 3, Gap(0.89)), Is.LessThan(radius));
      Assert.That(new Grid(3, Gap(0.9)).Reaches(Point(0, -2), new[] { Point(0, 2) }, radius), Is.EqualTo(new[] { false }));
    }

    [Test] public void BlockedStartsOutsideGoalsAndThinWallsCannotPass()
    {
      var grid = new Grid(3, new[] { new Rect(-3, 3, 0.10, 0.12) });
      Assert.That(grid.Reaches(Point(0, -2), new[] { Point(0, 2) }, 0.02), Is.EqualTo(new[] { false }));
      Assert.That(grid.Reaches(Point(0, 0.11), new[] { Point(0, 2) }, 0.45), Is.EqualTo(new[] { false }));
      Assert.That(grid.Reaches(Point(0, 2), new[] { Point(4, 2) }, 0.45), Is.EqualTo(new[] { false }));
    }
  }
}
