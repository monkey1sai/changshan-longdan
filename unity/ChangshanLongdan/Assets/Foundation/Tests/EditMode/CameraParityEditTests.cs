using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Animation;
using Changshan.Combat;
using Changshan.View;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E09: the camera rig, clearance, roof cutaway and control mapping replayed against the unmodified Web
  // (TestData/combat/web-camera.json), the Web's own camera-rig test cases restated in C#, the shake switch and the
  // mode machine.
  public sealed class CameraParityEditTests
  {
    static readonly string[] ScenarioIds =
    {
      "open_turn_zoom", "south_wall", "east_wall", "barracks_eave", "barracks_side", "barracks_corner_yaws", "walk_through_barracks",
      "musou_orbit", "title_to_battle", "jump_focus",
    };
    const double Aspect = 16.0 / 9;

    static string root;
    static Dictionary<string, object> fixture;

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = CameraParity.Load(root);
      }
    }

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
      Assert.That(CameraParity.Scenarios(Fixture).Select(s => (string)s["id"]).Distinct(), Is.EquivalentTo(ScenarioIds));
    }

    [Test] public void SamplesMatchWeb()
    {
      var result = CameraParity.CompareSamples(Fixture);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    [TestCase(30.0)]
    [TestCase(60.0)]
    [TestCase(120.0)]
    public void RigMatchesWebFrameByFrame(double hz)
    {
      var total = new CombatParity.Result();
      int n = 0;
      foreach (var s in CameraParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz))
      {
        total.Merge((string)s["id"], CameraParity.Run(Fixture, s));
        n++;
      }
      Assert.That(n, Is.EqualTo(ScenarioIds.Length));
      Assert.That(total.FailCount, Is.Zero, total.ToString());
      TestContext.WriteLine($"{hz} Hz: {total}");
    }

    // A changed port must be caught: a different damping rate shows up within a frame.
    [Test] public void ReplayDetectsADivergingRig()
    {
      var s = CameraParity.Scenarios(Fixture).First(x => (string)x["id"] == "open_turn_zoom" && (double)x["hz"] == 60);
      var frames = (List<object>)s["frames"];
      var frame = (Dictionary<string, object>)frames[30];
      frame["yaw"] = (double)frame["yaw"] + 1e-4;
      var result = CameraParity.Run(Fixture, s);
      frame["yaw"] = (double)frame["yaw"] - 1e-4;
      Assert.That(result.FailCount, Is.GreaterThan(0));
      Assert.That(result.Mismatches, Has.Some.Contains("f30 yaw"));
    }

    static CameraRig Settled(Vec3 target, double yaw, int frames = 360)
    {
      var rig = new CameraRig(Aspect);
      rig.Snap(target, yaw);
      for (int f = 0; f < frames; f++) rig.Update(1.0 / 60, target, 0, 0, false, false, f / 60.0);
      return rig;
    }

    // tests/camera-rig.test.ts restated.
    [Test] public void SnapResetsTheMovementAxes()
    {
      var rig = new CameraRig(Aspect);
      rig.Snap(default, Math.PI / 2);
      Assert.That(rig.Forward.X, Is.EqualTo(1).Within(1e-9));
      Assert.That(rig.Right.Z, Is.EqualTo(1).Within(1e-9));
    }

    [Test] public void RecenterApproachesTheFacingAndManualTurnInterrupts()
    {
      var rig = new CameraRig(Aspect);
      rig.Snap(default, 0);
      rig.Recenter(1);
      rig.Update(1.0 / 60, default, 0, 0, false, false, 0);
      Assert.That(rig.Yaw, Is.GreaterThan(0).And.LessThan(1));
      rig.Update(1.0 / 60, default, 1, 0, false, false, 0);
      double turned = rig.Yaw;
      rig.Update(1.0 / 60, default, 0, 0, false, false, 0);
      Assert.That(rig.Yaw, Is.EqualTo(turned));
    }

    [TestCase(0, 54.55, Math.PI)]
    [TestCase(54.55, 40, -Math.PI / 2)]
    [TestCase(38.9, 0, -Math.PI / 2)]
    public void NearWallsTheBoomShortensButKeepsItsHeight(double x, double z, double yaw)
    {
      var rig = Settled(new Vec3(x, 0, z), yaw);
      Assert.That(CombatMath.Hypot(rig.Position.X - x, rig.Position.Z - z), Is.LessThan(rig.Distance));
      Assert.That(rig.Position.Y - rig.Focus.Y, Is.EqualTo(4.4).Within(1e-3));
      Assert.That(Math.Abs(rig.Position.X), Is.LessThan(56));
      Assert.That(Math.Abs(rig.Position.Z), Is.LessThan(56));
    }

    [Test] public void OpenGroundKeepsTheFullDistanceAndHeight()
    {
      var rig = Settled(default, Math.PI);
      Assert.That(rig.Position.Z, Is.EqualTo(9.2).Within(1e-3));
      Assert.That(rig.Position.Y - rig.Focus.Y, Is.EqualTo(4.4).Within(1e-3));
    }

    [TestCase(48.5, 13.55, Math.PI)]
    [TestCase(39.55, 0, -Math.PI / 2)]
    [TestCase(-39.55, 0, Math.PI / 2)]
    public void UnderAnEaveTheCameraStaysOutsideAndForwardProjectsUp(double x, double z, double yaw)
    {
      var rig = Settled(new Vec3(x, 0, z), yaw);
      if (x > 40) Assert.That(rig.Position.Z, Is.LessThan(12.5));
      else Assert.That(Math.Abs(rig.Position.X), Is.LessThan(38.5));
      var ahead = rig.Project(rig.Focus.AddScaled(rig.Forward, 2));
      Assert.That(ahead.Y, Is.GreaterThan(0));
      Assert.That(Math.Abs(ahead.X), Is.LessThan(0.001));
    }

    [TestCase(0.0)]
    [TestCase(Math.PI / 4)]
    [TestCase(Math.PI / 2)]
    [TestCase(Math.PI)]
    [TestCase(-Math.PI / 2)]
    public void AtABarracksCornerForwardStillProjectsAboveTheCentre(double yaw)
    {
      var rig = new CameraRig(4.0 / 3);
      var target = new Vec3(39.6, 0, 13.6);
      rig.Snap(target, yaw);
      for (int f = 0; f < 360; f++) rig.Update(1.0 / 60, target, 0, 0, false, false, f / 60.0);
      var centre = rig.Project(rig.Focus);
      var ahead = rig.Project(rig.Focus.AddScaled(rig.Forward, 1));
      Assert.That(ahead.Y, Is.GreaterThan(centre.Y));
      Assert.That(rig.Position.X < 38.5 || rig.Position.Z < 12.5, Is.True);
    }

    // The Unity-only switch: with shake off, trauma and kick never move the camera or the field of view.
    [Test] public void ShakeOffIgnoresTraumaAndKick()
    {
      var on = Settled(default, Math.PI, 300);
      var off = Settled(default, Math.PI, 300);
      off.ShakeEnabled = false;
      on.AddTrauma(0.8); on.Kick(0.6);
      off.AddTrauma(0.8); off.Kick(0.6);
      Assert.That(off.Trauma, Is.Zero);
      Assert.That(off.Punch, Is.Zero);
      on.Update(1.0 / 60, default, 0, 0, false, false, 5.0);
      off.Update(1.0 / 60, default, 0, 0, false, false, 5.0);
      Assert.That(on.Position.DistanceTo(off.Position), Is.GreaterThan(0.01), "shake displaces the camera when on");
      Assert.That(on.Fov, Is.LessThan(off.Fov), "the kick narrows the field of view when on");
      Assert.That(off.Fov, Is.EqualTo(55).Within(0.1));
      // Switching off mid-shake lets the running shake decay instead of freezing it.
      on.ShakeEnabled = false;
      for (int f = 0; f < 120; f++) on.Update(1.0 / 60, default, 0, 0, false, false, 5 + f / 60.0);
      Assert.That(on.Trauma, Is.Zero);
      Assert.That(on.Position.DistanceTo(off.Position), Is.LessThan(1e-6));
    }

    // game.ts mode handling.
    [Test] public void ModesFollowTheWebFlow()
    {
      var modes = new GameModes();
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Title));
      Assert.That(modes.AcceptsCombatInput, Is.False);
      Assert.That(modes.Step(new InputFrame { Pause = true }, 1.0 / 60), Is.EqualTo(ModeAction.None), "pause on the title does nothing");
      Assert.That(modes.Step(new InputFrame { Attack = true }, 1.0 / 60), Is.EqualTo(ModeAction.StartBattle), "J starts the battle from the title");
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Playing));
      Assert.That(modes.Step(new InputFrame { Attack = true, Confirm = true }, 1.0 / 60), Is.EqualTo(ModeAction.None), "J and Enter are combat input while playing");
      Assert.That(modes.FocusLost(), Is.EqualTo(ModeAction.Pause));
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Paused));
      Assert.That(modes.FocusLost(), Is.EqualTo(ModeAction.None), "already paused");
      Assert.That(modes.Step(new InputFrame { Attack = true }, 1.0 / 60), Is.EqualTo(ModeAction.None), "J does not resume");
      Assert.That(modes.Step(new InputFrame { Confirm = true }, 1.0 / 60), Is.EqualTo(ModeAction.Resume), "Enter resumes");
      Assert.That(modes.Step(new InputFrame { Pause = true }, 1.0 / 60), Is.EqualTo(ModeAction.Pause));
      Assert.That(modes.ResumeRequested(), Is.EqualTo(ModeAction.Resume));
      Assert.That(modes.StartRequested(), Is.EqualTo(ModeAction.None), "no restart while playing");
      modes.End();
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Ended));
      Assert.That(modes.Simulates, Is.True, "the fight keeps stepping after the outcome");
      Assert.That(modes.AcceptsCombatInput, Is.False);
      Assert.That(modes.Step(new InputFrame { Confirm = true }, 1.0), Is.EqualTo(ModeAction.None), "Enter before the result is shown");
      Assert.That(modes.ResultShown, Is.False);
      Assert.That(modes.Step(default, 1.5), Is.EqualTo(ModeAction.None));
      Assert.That(modes.ResultShown, Is.True, "shown 2.4 s after the outcome");
      Assert.That(modes.FocusLost(), Is.EqualTo(ModeAction.None), "focus loss does not pause the result");
      Assert.That(modes.Step(new InputFrame { Confirm = true }, 1.0 / 60), Is.EqualTo(ModeAction.StartBattle), "Enter retries");
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Playing));
      modes.End();
      modes.End();
      Assert.That(modes.Mode, Is.EqualTo(GameMode.Ended));
    }

    [Test] public void RankFollowsBattleRank()
    {
      Assert.That(BattleRank.Rank(true, 300, 200, 100), Is.EqualTo("S"));
      Assert.That(BattleRank.Rank(true, 300, 200, 400), Is.EqualTo("A"));
      Assert.That(BattleRank.Rank(true, 300, 500, 100), Is.EqualTo("B"));
      Assert.That(BattleRank.Rank(false, 200, 100, 0), Is.EqualTo("B"));
      Assert.That(BattleRank.Rank(false, 100, 100, 0), Is.EqualTo("C"));
      Assert.That(BattleRank.Rank(false, 99, 100, 0), Is.EqualTo("D"));
    }

    [Test] public void GeometryAndHelpersRejectBadInput()
    {
      Assert.Throws<ArgumentOutOfRangeException>(() => new CameraRig(0));
      Assert.Throws<ArgumentException>(() => RoofCutaway.Update(new bool[3], 0, 0, false));
      // The blockers are the collision set without the barracks bodies, plus the six eave rectangles.
      var blockers = CastleGeometry.CameraBlockers;
      foreach (var b in CastleGeometry.Barracks) Assert.That(blockers.Any(r => r.MinX == b.MinX && r.MaxX == b.MaxX && r.MinZ == b.MinZ && r.MaxZ == b.MaxZ), Is.False);
      foreach (var r in CastleGeometry.Roofs) Assert.That(blockers.Any(x => x.MinX == r.MinX && x.MaxX == r.MaxX && x.MinZ == r.MinZ && x.MaxZ == r.MaxZ), Is.True);
      Assert.That(blockers.Any(r => r.MinX == CastleGeometry.Keep.MinX && r.MaxZ == CastleGeometry.Keep.MaxZ), Is.True);
      Assert.That(blockers.Count, Is.EqualTo(ArenaLayout.Obstacles().Length));
      Assert.That(CastleGeometry.Wrecks.Count, Is.EqualTo(2));
    }
  }
}
