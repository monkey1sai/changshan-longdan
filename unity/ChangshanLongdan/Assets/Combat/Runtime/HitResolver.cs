using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  public enum HitSource { Player, External }

  // One target taking damage from one hit-window instance. Stamp identifies the instance (move start × window).
  public readonly struct HitEvent
  {
    public readonly long Step;
    public readonly double SimTime;
    public readonly HitSource Source;
    public readonly uint Stamp;
    public readonly MoveId? Move;
    public readonly int WindowIndex;
    public readonly int Target;
    public readonly double Damage;
    public readonly float HpAfter;
    public readonly bool Killed;
    public readonly double DirX, DirZ;
    public readonly double X, Y, Z; // the target's position when hit (Web HitInfo; sparks spawn here)

    public HitEvent(long step, double simTime, HitSource source, uint stamp, MoveId? move, int windowIndex, int target, double damage,
      float hpAfter, bool killed, double dirX, double dirZ, double x, double y, double z)
    {
      X = x;
      Y = y;
      Z = z;
      Step = step;
      SimTime = simTime;
      Source = source;
      Stamp = stamp;
      Move = move;
      WindowIndex = windowIndex;
      Target = target;
      Damage = damage;
      HpAfter = hpAfter;
      Killed = killed;
      DirX = dirX;
      DirZ = dirZ;
    }
  }

  // Port of EnemyStore.applyHit with stronger identity. The Web remembers only the last stamp per soldier, so a second
  // source hitting in between lets the first window hit again; here every (window instance, target) pair hits at most
  // once. A pair is forgotten when its window stops being applied, so memory stays bounded by the active windows.
  public sealed class HitResolver
  {
    public const double DefaultYMin = -0.6;
    public const double DefaultYMax = 2.6;

    readonly HitTargets targets;
    readonly HashSet<ulong> pairs = new HashSet<ulong>();
    readonly Dictionary<uint, List<int>> targetsByStamp = new Dictionary<uint, List<int>>();
    readonly HashSet<uint> appliedThisStep = new HashSet<uint>();
    readonly Stack<List<int>> pool = new Stack<List<int>>();
    readonly List<uint> scratch = new List<uint>();
    readonly List<int> candidates = new List<int>();

    public HitResolver(HitTargets targets) => this.targets = targets ?? throw new ArgumentNullException(nameof(targets));

    public int RememberedPairs => pairs.Count;
    public int ActiveWindows => targetsByStamp.Count;

    // Call once per simulated step before applying windows: windows not applied during the previous step have ended.
    public void BeginStep()
    {
      scratch.Clear();
      foreach (var stamp in targetsByStamp.Keys) if (!appliedThisStep.Contains(stamp)) scratch.Add(stamp);
      foreach (var stamp in scratch)
      {
        var list = targetsByStamp[stamp];
        foreach (int target in list) pairs.Remove(Key(stamp, target));
        list.Clear();
        pool.Push(list);
        targetsByStamp.Remove(stamp);
      }
      appliedThisStep.Clear();
    }

    public bool WasHit(uint stamp, int target) => pairs.Contains(Key(stamp, target));

    // Returns how many targets this call hit and appends one event per hit, in target order.
    public int Apply(uint stamp, HitWindow w, double ax, double ay, double az, double facing, HitSource source, MoveId? move,
      int windowIndex, long step, double simTime, List<HitEvent> output)
    {
      if (w == null) throw new ArgumentNullException(nameof(w));
      if (output == null) throw new ArgumentNullException(nameof(output));
      if (stamp == 0) throw new ArgumentOutOfRangeException(nameof(stamp), "HIT_STAMP_ZERO");
      appliedThisStep.Add(stamp);
      double fx = Math.Sin(facing), fz = Math.Cos(facing);
      double cx = ax + fx * w.Shape.Offset, cz = az + fz * w.Shape.Offset;
      double yMin = ay + (w.YMin ?? DefaultYMin), yMax = ay + (w.YMax ?? DefaultYMax);
      int hits = 0;
      // Candidates in the Web's spatial-hash order: hits, reactions and rng draws happen in the same order as applyHit.
      targets.Query(ax, az, w.Shape.Reach + HitTargets.BodyRadius * 1.5 + 0.5, candidates);
      for (int k = 0; k < candidates.Count; k++)
      {
        int i = candidates[k];
        if (!targets.Alive(i) || pairs.Contains(Key(stamp, i))) continue;
        double ty = targets.Y(i);
        if (ty < yMin || ty > yMax) continue;
        if (!w.Shape.Contains(ax, az, facing, targets.X(i), targets.Z(i), targets.Radius(i))) continue;
        Remember(stamp, i);
        double dirX = fx, dirZ = fz;
        if (w.Radial)
        {
          double dx = targets.X(i) - cx, dz = targets.Z(i) - cz;
          double d = CombatMath.Hypot(dx, dz);
          if (d > 1e-3)
          {
            dirX = dx / d;
            dirZ = dz / d;
          }
        }
        bool killed = targets.Damage(i, w, dirX, dirZ);
        output.Add(new HitEvent(step, simTime, source, stamp, move, windowIndex, i, w.Damage, targets.Hp(i), killed, dirX, dirZ,
          targets.X(i), targets.Y(i), targets.Z(i)));
        hits++;
      }
      return hits;
    }

    public void Clear()
    {
      pairs.Clear();
      foreach (var list in targetsByStamp.Values)
      {
        list.Clear();
        pool.Push(list);
      }
      targetsByStamp.Clear();
      appliedThisStep.Clear();
    }

    void Remember(uint stamp, int target)
    {
      pairs.Add(Key(stamp, target));
      if (!targetsByStamp.TryGetValue(stamp, out var list))
      {
        list = pool.Count > 0 ? pool.Pop() : new List<int>();
        targetsByStamp.Add(stamp, list);
      }
      list.Add(target);
    }

    static ulong Key(uint stamp, int target) => ((ulong)stamp << 32) | (uint)target;
  }
}
