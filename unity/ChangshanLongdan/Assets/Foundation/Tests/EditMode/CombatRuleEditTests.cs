using System;
using System.Collections.Generic;
using Changshan.Combat;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  // E04: tuning validation, per-player state isolation and immutable move data.
  public sealed class CombatRuleEditTests
  {
    static readonly PlayerControls Idle = default;

    [Test] public void TuningDefaultsAreTheWebConstants()
    {
      var t = PlayerTuning.Default;
      Assert.That(t.SchemaVersion, Is.EqualTo(1));
      Assert.That(t.Units, Is.EqualTo("meters,seconds,radians"));
      Assert.That(t.InputBuffer, Is.EqualTo(0.45));
      Assert.That(t.MaxHp, Is.EqualTo(1000));
      Assert.That(t.MusouMax, Is.EqualTo(100));
      Assert.That(t.RunSpeed, Is.EqualTo(7.4));
      Assert.That(t.Gravity, Is.EqualTo(30));
      Assert.That(t.JumpSpeed, Is.EqualTo(10.5));
      Assert.That(t.DodgeSpeed, Is.EqualTo(15));
      Assert.That(t.DodgeTime, Is.EqualTo(0.42));
      Assert.That(t.DashCancelTime, Is.EqualTo(0.1));
      Assert.That(t.GuardArcCos, Is.EqualTo(Math.Cos(Math.PI * 0.36)));
      Assert.That(t.ParryTime, Is.EqualTo(0.16));
      Assert.That(t.CounterTime, Is.EqualTo(0.72));
      Assert.That(t.BodyRadius, Is.EqualTo(0.45));
      // The buffer must cover the longest chain wait (N5 cancel).
      Assert.That(t.InputBuffer, Is.GreaterThanOrEqualTo(Moves.Get(MoveId.N5).Cancel));
    }

    [Test] public void TuningRejectsAnotherSchemaVersion()
    {
      var e = Assert.Throws<ArgumentException>(() => new PlayerTuning(schemaVersion: 2));
      StringAssert.StartsWith("TUNING_SCHEMA_VERSION", e.Message);
    }

    [Test] public void TuningRejectsOtherUnits()
    {
      foreach (string units in new[] { "centimeters,seconds,radians", "meters,milliseconds,radians", "meters,seconds,degrees", "", null })
      {
        var e = Assert.Throws<ArgumentException>(() => new PlayerTuning(units: units), units ?? "null");
        StringAssert.StartsWith("TUNING_UNITS", e.Message);
      }
    }

    [Test] public void TuningRejectsNonFiniteValues()
    {
      foreach (double bad in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity })
      {
        StringAssert.StartsWith("TUNING_NOT_FINITE", Assert.Throws<ArgumentException>(() => new PlayerTuning(inputBuffer: bad)).Message);
        StringAssert.StartsWith("TUNING_NOT_FINITE", Assert.Throws<ArgumentException>(() => new PlayerTuning(runSpeed: bad)).Message);
      }
    }

    [Test] public void TuningRejectsOutOfRangeValues()
    {
      Assert.Throws<ArgumentOutOfRangeException>(() => new PlayerTuning(maxHp: 0));
      Assert.Throws<ArgumentOutOfRangeException>(() => new PlayerTuning(inputBuffer: -0.45));
      Assert.Throws<ArgumentOutOfRangeException>(() => new PlayerTuning(guardHalfAngle: Math.PI));
      Assert.Throws<ArgumentOutOfRangeException>(() => new PlayerTuning(dashCancelTime: 0.5, dodgeTime: 0.42));
    }

    // Negative for shared state: damage, buffers and hit stamps of one player must never reach another.
    [Test] public void PlayersDoNotShareHpBuffersOrStamps()
    {
      var arena = ArenaLayout.CreateArena();
      var a = new Player();
      var b = new Player();
      a.Reset(0, 42, Math.PI);
      b.Reset(0, 42, Math.PI);
      a.TakeHit(100, false, 0, 40);
      Assert.That(a.Hp, Is.EqualTo(900));
      Assert.That(b.Hp, Is.EqualTo(1000));

      a.Queue(new PlayerControls { Charge = true, Jump = true, Dodge = true, Musou = true });
      Assert.That(a.BufferedButton, Is.EqualTo(ChargeButton.Charge));
      Assert.That(b.BufferedButton, Is.Null);
      Assert.That(b.JumpBuffer + b.DodgeBuffer + b.MusouBuffer, Is.Zero);

      var c = new Player();
      var d = new Player();
      c.Reset(0, 42, Math.PI);
      d.Reset(0, 42, Math.PI);
      var press = new PlayerControls { Attack = true };
      c.Update(1.0 / 60, press, null, arena);
      d.Update(1.0 / 60, press, null, arena);
      for (int i = 0; i < 7; i++) // moveTime 7/60 s lies inside N1 window 0.10–0.16 s
      {
        c.Update(1.0 / 60, Idle, null, arena);
        d.Update(1.0 / 60, Idle, null, arena);
      }
      Assert.That(c.ActiveHits, Has.Count.EqualTo(1));
      Assert.That(d.ActiveHits, Has.Count.EqualTo(1));
      // Separate stamp sources: both first windows carry id 1, as two independent Web sessions would.
      Assert.That(c.ActiveHits[0].Stamp, Is.EqualTo(1u));
      Assert.That(d.ActiveHits[0].Stamp, Is.EqualTo(1u));

      // A shared source is opt-in and then issues distinct ids.
      var shared = new HitStampSource();
      var e = new Player(stampSource: shared);
      var f = new Player(stampSource: shared);
      e.Reset(0, 42, Math.PI);
      f.Reset(0, 42, Math.PI);
      e.Update(1.0 / 60, press, null, arena);
      f.Update(1.0 / 60, press, null, arena);
      for (int i = 0; i < 7; i++) // moveTime 7/60 s lies inside N1 window 0.10–0.16 s
      {
        e.Update(1.0 / 60, Idle, null, arena);
        f.Update(1.0 / 60, Idle, null, arena);
      }
      Assert.That(e.ActiveHits[0].Stamp, Is.Not.EqualTo(f.ActiveHits[0].Stamp));
    }

    [Test] public void MoveDataCannotBeChangedAfterConstruction()
    {
      var hits = new[] { new HitWindow(0.1, 0.2, HitShape.Circle(1), 5, Reaction.Flinch) };
      var swings = new[] { 0.1 };
      var height = new double[,] { { 0, 0 }, { 0.2, 1 } };
      var move = new MoveDefinition(MoveId.N1, "test", 0.4, 0.2, hits, new[] { new Lunge(0, 0.1, 0.3) }, new[] { (0.0, 0.2) }, swings, height: height);
      hits[0] = new HitWindow(0.3, 0.4, HitShape.Circle(9), 99, Reaction.Blowaway);
      swings[0] = 9;
      height[1, 1] = 9;
      Assert.That(move.Hits[0].Damage, Is.EqualTo(5));
      Assert.That(move.Swings[0], Is.EqualTo(0.1));
      Assert.That(move.HeightKey(1).Value, Is.EqualTo(1));
      Assert.That(move.Hits, Is.InstanceOf<System.Collections.ObjectModel.ReadOnlyCollection<HitWindow>>());
      Assert.Throws<NotSupportedException>(() => ((IList<HitWindow>)move.Hits).Add(hits[0]));
      Assert.That(Moves.Get(MoveId.MUSOU).Hits, Has.Count.EqualTo(20));
      Assert.That(Moves.Get(MoveId.C5).Hits, Has.Count.EqualTo(9));
    }

    [Test] public void HitStampsSkipZeroWhenWrapping()
    {
      var source = new HitStampSource();
      Assert.That(source.Next(), Is.EqualTo(1u));
      Assert.That(source.Next(), Is.EqualTo(2u));
      var wrap = typeof(HitStampSource).GetField("counter", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
      wrap.SetValue(source, uint.MaxValue);
      Assert.That(source.Next(), Is.EqualTo(1u));
    }
  }
}
