using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Changshan.Combat
{
  // Port of src/combat/moves.ts without rebalance. Values are checked against the generated Web fixture.
  public static class Moves
  {
    public const double MusouFinale = 3.02;

    static readonly MoveDefinition[] all = Build();
    static readonly ReadOnlyCollection<MoveDefinition> readOnlyAll = new ReadOnlyCollection<MoveDefinition>(all);

    // A wrapper, not the array, so callers cannot cast it back and replace a move.
    public static IReadOnlyList<MoveDefinition> All => readOnlyAll;

    public static MoveDefinition Get(MoveId id) => all[(int)id];

    static HitShape Arc(double range, double halfDegrees) => HitShape.Arc(range, halfDegrees);
    static HitShape Circle(double range) => HitShape.Circle(range);
    static HitShape Line(double range, double width) => HitShape.Line(range, width);

    static MoveDefinition[] Build()
    {
      var c5Hits = new List<HitWindow>();
      for (int i = 0; i < 8; i++)
      {
        double t0 = 0.11 + i * 0.08;
        c5Hits.Add(new HitWindow(t0, t0 + 0.04, Arc(3.6, 32), 7, Reaction.Flinch, push: 1.2, hitstop: 0.025, shake: 0.08, sfx: HitSfx.Pierce));
      }
      c5Hits.Add(new HitWindow(0.9, 1.0, Line(4.8, 2.4), 30, Reaction.Blowaway, push: 17, lift: 4.5, hitstop: 0.11, shake: 0.55, sfx: HitSfx.Heavy));

      var musouHits = new List<HitWindow>();
      for (int i = 0; i < 19; i++)
      {
        double t0 = 0.32 + i * 0.12;
        musouHits.Add(new HitWindow(t0, t0 + 0.05, Circle(4.4), 11, Reaction.Launch, push: 2.5, lift: 3.2, radial: true, yMin: -1, yMax: 6,
          hitstop: 0.012, shake: 0.12));
      }
      musouHits.Add(new HitWindow(MusouFinale, MusouFinale + 0.1, Circle(9.5), 70, Reaction.Blowaway, push: 20, lift: 8, radial: true,
        yMin: -2, yMax: 8, hitstop: 0.22, shake: 1, sfx: HitSfx.Heavy, fx: HitFx.Blast));

      var moves = new[]
      {
        new MoveDefinition(MoveId.N1, "刺", 0.42, 0.2,
          new[] { new HitWindow(0.1, 0.16, Line(3.4, 1.3), 14, Reaction.Flinch, push: 3, sfx: HitSfx.Pierce) },
          new[] { new Lunge(0, 0.12, 0.35) }, new[] { (0.06, 0.2) }, new[] { 0.06 }),
        new MoveDefinition(MoveId.N2, "橫掃", 0.46, 0.22,
          new[] { new HitWindow(0.1, 0.22, Arc(3.3, 80), 14, Reaction.Flinch, push: 3.5) },
          new[] { new Lunge(0, 0.14, 0.4) }, new[] { (0.06, 0.26) }, new[] { 0.07 }),
        new MoveDefinition(MoveId.N3, "回掃", 0.46, 0.22,
          new[] { new HitWindow(0.1, 0.22, Arc(3.3, 80), 15, Reaction.Flinch, push: 3.5) },
          new[] { new Lunge(0, 0.14, 0.4) }, new[] { (0.05, 0.26) }, new[] { 0.06 }),
        new MoveDefinition(MoveId.N4, "雙突", 0.55, 0.32,
          new[]
          {
            new HitWindow(0.1, 0.14, Line(3.6, 1.4), 11, Reaction.Flinch, sfx: HitSfx.Pierce),
            new HitWindow(0.24, 0.28, Line(3.8, 1.5), 12, Reaction.Flinch, push: 4.5, sfx: HitSfx.Pierce),
          },
          new[] { new Lunge(0, 0.12, 0.35), new Lunge(0.17, 0.26, 0.35) }, new[] { (0.06, 0.32) }, new[] { 0.07, 0.2 }),
        new MoveDefinition(MoveId.N5, "旋槍", 0.6, 0.36,
          new[] { new HitWindow(0.12, 0.3, Circle(3.4), 16, Reaction.Knockback, push: 6.5, radial: true, hitstop: 0.06, shake: 0.18) },
          new[] { new Lunge(0.05, 0.3, 0.5) }, new[] { (0.08, 0.34) }, new[] { 0.1, 0.2 }),
        new MoveDefinition(MoveId.N6, "龍牙突", 0.85, 0.62,
          new[] { new HitWindow(0.14, 0.24, Line(4.8, 2.2), 26, Reaction.Blowaway, push: 15, lift: 4.5, hitstop: 0.09, shake: 0.45, sfx: HitSfx.Heavy) },
          new[] { new Lunge(0.08, 0.22, 1.7) }, new[] { (0.08, 0.3) }, new[] { 0.1 }),

        new MoveDefinition(MoveId.C1, "挑槍", 0.72, 0.52,
          new[] { new HitWindow(0.14, 0.24, Arc(3.3, 60), 18, Reaction.Launch, push: 2, lift: 8, hitstop: 0.07, shake: 0.25, sfx: HitSfx.Heavy) },
          new[] { new Lunge(0.05, 0.2, 0.5) }, new[] { (0.1, 0.3) }, new[] { 0.12 }),
        new MoveDefinition(MoveId.C2, "昇龍", 0.78, 0.55,
          new[] { new HitWindow(0.16, 0.28, Arc(3.6, 75), 20, Reaction.Launch, push: 1.5, lift: 10.5, hitstop: 0.08, shake: 0.3, sfx: HitSfx.Heavy) },
          new[] { new Lunge(0.05, 0.22, 0.6) }, new[] { (0.1, 0.32) }, new[] { 0.14 },
          height: new double[,] { { 0, 0 }, { 0.14, 0 }, { 0.24, 0.55 }, { 0.4, 0 } }),
        new MoveDefinition(MoveId.C3, "追龍", 1.2, 1.0,
          new[]
          {
            new HitWindow(0.14, 0.24, Arc(3.5, 70), 16, Reaction.Launch, lift: 10, push: 1.5, hitstop: 0.06, shake: 0.2, sfx: HitSfx.Heavy),
            new HitWindow(0.36, 0.44, Arc(3.4, 85), 12, Reaction.Launch, lift: 6, push: 1, hitstop: 0.05, yMin: -4, yMax: 5),
            new HitWindow(0.52, 0.6, Arc(3.4, 85), 12, Reaction.Launch, lift: 6, push: 1, hitstop: 0.05, yMin: -4, yMax: 5),
            new HitWindow(0.68, 0.76, Arc(3.4, 85), 13, Reaction.Launch, lift: 6, push: 1, hitstop: 0.05, yMin: -4, yMax: 5),
            new HitWindow(0.88, 0.98, Circle(3.4), 24, Reaction.Knockdown, push: 4, radial: true, yMin: -1, yMax: 5, hitstop: 0.1, shake: 0.45,
              sfx: HitSfx.Heavy, fx: HitFx.Shockwave),
          },
          new[] { new Lunge(0.05, 0.22, 0.6), new Lunge(0.3, 0.8, 0.8) }, new[] { (0.1, 0.95) }, new[] { 0.14, 0.37, 0.53, 0.69, 0.86 },
          height: new double[,] { { 0, 0 }, { 0.12, 0 }, { 0.34, 3.1 }, { 0.8, 3.3 }, { 0.9, 0 } }),
        new MoveDefinition(MoveId.C4, "迴龍掃", 0.9, 0.7,
          new[]
          {
            new HitWindow(0.14, 0.3, Circle(3.9), 16, Reaction.Knockback, push: 7, radial: true, hitstop: 0.05, shake: 0.2),
            new HitWindow(0.36, 0.52, Circle(4.1), 18, Reaction.Blowaway, push: 12, lift: 3.5, radial: true, hitstop: 0.08, shake: 0.35, sfx: HitSfx.Heavy),
          },
          new[] { new Lunge(0.1, 0.5, 0.8) }, new[] { (0.1, 0.56) }, new[] { 0.14, 0.26, 0.38, 0.5 }, armor: true),
        new MoveDefinition(MoveId.C5, "百烈槍", 1.35, 1.12, c5Hits.ToArray(),
          new[] { new Lunge(0.08, 0.72, 0.9), new Lunge(0.82, 0.96, 1.3) }, new[] { (0.08, 1.05) }, new[] { 0.1, 0.26, 0.42, 0.58, 0.88 }, armor: true),
        new MoveDefinition(MoveId.C6, "天龍破", 1.3, 1.08,
          new[]
          {
            new HitWindow(0.1, 0.2, Arc(3.2, 70), 14, Reaction.Launch, lift: 7, push: 2, hitstop: 0.05, shake: 0.2),
            new HitWindow(0.56, 0.66, Circle(6.5), 42, Reaction.Blowaway, push: 16, lift: 6.5, radial: true, yMin: -1, yMax: 4, hitstop: 0.15, shake: 0.95,
              sfx: HitSfx.Heavy, fx: HitFx.Shockwave),
          },
          new[] { new Lunge(0.12, 0.52, 2.2) }, new[] { (0.08, 0.6) }, new[] { 0.1, 0.4 }, armor: true,
          height: new double[,] { { 0, 0 }, { 0.12, 0 }, { 0.36, 3.6 }, { 0.48, 3.8 }, { 0.56, 0 } }),

        new MoveDefinition(MoveId.JA, "落鳳", 0.5, 0.42,
          new[] { new HitWindow(0.14, 0.22, Circle(2.8), 16, Reaction.Knockdown, push: 5, radial: true, hitstop: 0.06, shake: 0.3, sfx: HitSfx.Heavy, fx: HitFx.Shockwave) },
          new[] { new Lunge(0, 0.16, 1.2) }, new[] { (0.02, 0.2) }, new[] { 0.04 }, airborne: true,
          height: new double[,] { { 0, 1 }, { 0.16, 0 } }, heightRelative: true),
        new MoveDefinition(MoveId.JC, "旋空", 0.6, 0.5,
          new[] { new HitWindow(0.08, 0.34, Circle(3.3), 14, Reaction.Knockdown, push: 4, radial: true, yMin: -3, yMax: 3, hitstop: 0.05, shake: 0.2) },
          new Lunge[0], new[] { (0.06, 0.36) }, new[] { 0.08, 0.22 }, airborne: true,
          height: new double[,] { { 0, 1 }, { 0.3, 1.05 }, { 0.46, 0 } }, heightRelative: true),
        new MoveDefinition(MoveId.DASH, "疾風突", 0.46, 0.28,
          new[] { new HitWindow(0.1, 0.18, Line(4.2, 1.55), 20, Reaction.Knockback, push: 8, hitstop: 0.07, shake: 0.26, sfx: HitSfx.Pierce) },
          new[] { new Lunge(0, 0.16, 2.25) }, new[] { (0.05, 0.22) }, new[] { 0.06 }),
        new MoveDefinition(MoveId.COUNTER, "龍膽返", 0.58, 0.4,
          new[] { new HitWindow(0.12, 0.22, Arc(4.1, 85), 34, Reaction.Blowaway, push: 13, lift: 3, hitstop: 0.1, shake: 0.48, sfx: HitSfx.Heavy, fx: HitFx.Shockwave) },
          new[] { new Lunge(0.02, 0.16, 0.85) }, new[] { (0.06, 0.26) }, new[] { 0.08 }, armor: true),
        new MoveDefinition(MoveId.MUSOU, "蒼龍破陣", 3.6, 3.6, musouHits.ToArray(),
          new[] { new Lunge(2.95, 3.1, 2.5) }, new[] { (0.3, 3.2) }, new[] { 0.35, 0.8, 1.25, 1.7, 2.15, 2.98 }, armor: true),
      };
      for (int i = 0; i < moves.Length; i++)
        if ((int)moves[i].Id != i) throw new InvalidOperationException($"Move table order mismatch at {moves[i].Id}");
      return moves;
    }
  }
}
