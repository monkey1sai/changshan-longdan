using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Changshan.Combat
{
  // Declaration order matches the Web MOVES record.
  public enum MoveId { N1, N2, N3, N4, N5, N6, C1, C2, C3, C4, C5, C6, JA, JC, DASH, COUNTER, MUSOU }
  public enum Reaction { Flinch, Launch, Knockback, Blowaway, Knockdown }
  public enum HitSfx { Light, Heavy, Pierce }
  public enum HitFx { None, Shockwave, Blast }

  // One damage window of a move; times are seconds from the move start.
  public sealed class HitWindow
  {
    public double T0 { get; }
    public double T1 { get; }
    public HitShape Shape { get; }
    public double Damage { get; }
    public Reaction Reaction { get; }
    public double Push { get; }
    public double Lift { get; }
    public double Hitstop { get; }
    public double Shake { get; }
    public HitSfx Sfx { get; }
    public bool Radial { get; }
    public double? YMin { get; }
    public double? YMax { get; }
    public HitFx Fx { get; }

    public HitWindow(double t0, double t1, HitShape shape, double damage, Reaction reaction, double push = 3, double lift = 0,
      double hitstop = 0.05, double shake = 0.12, HitSfx sfx = HitSfx.Light, bool radial = false, double? yMin = null,
      double? yMax = null, HitFx fx = HitFx.None)
    {
      T0 = t0;
      T1 = t1;
      Shape = shape ?? throw new ArgumentNullException(nameof(shape));
      Damage = damage;
      Reaction = reaction;
      Push = push;
      Lift = lift;
      Hitstop = hitstop;
      Shake = shake;
      Sfx = sfx;
      Radial = radial;
      YMin = yMin;
      YMax = yMax;
      Fx = fx;
    }
  }

  public readonly struct Lunge
  {
    public readonly double T0, T1, Distance;
    public Lunge(double t0, double t1, double distance) { T0 = t0; T1 = t1; Distance = distance; }
  }

  // Immutable move data; the arrays given to the constructor are copied.
  public sealed class MoveDefinition
  {
    public MoveId Id { get; }
    public string Name { get; }
    public double Duration { get; }
    public double Cancel { get; } // earliest time the next move may start
    public IReadOnlyList<HitWindow> Hits { get; }
    public IReadOnlyList<Lunge> Lunges { get; }
    public IReadOnlyList<(double Start, double End)> Trail { get; }
    public IReadOnlyList<double> Swings { get; }
    public bool Armor { get; }
    public bool Airborne { get; }
    public bool HasHeight => heightKeys != null;
    public bool HeightRelative { get; }
    public int HeightKeyCount => heightKeys?.GetLength(0) ?? 0;
    public bool IsNormal => Id <= MoveId.N6;
    public bool IsCharge => Id >= MoveId.C1 && Id <= MoveId.C6;
    public int Index => IsNormal ? Id - MoveId.N1 + 1 : 0;

    readonly double[,] heightKeys;

    public MoveDefinition(MoveId id, string name, double duration, double cancel, HitWindow[] hits, Lunge[] lunges,
      (double, double)[] trail, double[] swings, bool armor = false, bool airborne = false, double[,] height = null, bool heightRelative = false)
    {
      Id = id;
      Name = name;
      Duration = duration;
      Cancel = cancel;
      Hits = new ReadOnlyCollection<HitWindow>((HitWindow[])hits.Clone());
      Lunges = new ReadOnlyCollection<Lunge>((Lunge[])lunges.Clone());
      Trail = new ReadOnlyCollection<(double, double)>(((double, double)[])trail.Clone());
      Swings = new ReadOnlyCollection<double>((double[])swings.Clone());
      Armor = armor;
      Airborne = airborne;
      heightKeys = (double[,])height?.Clone();
      HeightRelative = heightRelative;
    }

    public (double Time, double Value) HeightKey(int index) => (heightKeys[index, 0], heightKeys[index, 1]);

    public double SampleHeight(double t) => CombatMath.SampleKeys(heightKeys, t);
  }
}
