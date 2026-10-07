using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Changshan.Animation;
using Changshan.Combat;
using Changshan.View;

namespace Changshan.Foundation.Tests
{
  // E09: replays TestData/combat/web-camera.json (the unmodified Web camera rig, clearance, roof cutaway and control
  // mapping) through the C# port and compares every recorded frame and sample.
  public static class CameraParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-camera.json";
    public const double Tolerance = 1e-6; // doubles throughout; sin/cos/exp may differ in the last bits
    public const double QuaternionTolerance = 1e-6; // 1 - |dot|

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;
    static double D(object o) => o is bool b ? (b ? 1 : 0) : (double)o;
    static string F(double v) => v.ToString("R", CultureInfo.InvariantCulture);

    public static Dictionary<string, object> Load(string repoRoot) =>
      (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(Path.Combine(repoRoot, FixturePath)));

    public static IEnumerable<Dictionary<string, object>> Scenarios(Dictionary<string, object> fixture)
    {
      foreach (var s in L(fixture["scenarios"])) yield return O(s);
    }

    public static double Aspect(Dictionary<string, object> fixture) => D(O(fixture["constants"])["aspect"]);

    // Replays one scenario: the recorded inputs drive the C# rig, every recorded value is compared.
    public static CombatParity.Result Run(Dictionary<string, object> fixture, Dictionary<string, object> scenario)
    {
      var result = new CombatParity.Result();
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      var rig = new CameraRig(Aspect(fixture));
      var frames = L(scenario["frames"]);
      var first = L(O(frames[0])["in"]);
      rig.Snap(new Vec3(D(first[0]), D(first[1]), D(first[2])), D(scenario["snapYaw"]));
      var roofs = new bool[CastleGeometry.Barracks.Count];
      for (int i = 0; i < roofs.Length; i++) roofs[i] = true;
      string id = $"{(string)scenario["id"]}@{F(hz)}";
      bool wasTitle = false;
      var pending = Events(scenario);
      foreach (var frameObject in frames)
      {
        var frame = O(frameObject);
        int f = (int)D(frame["f"]);
        string at = $"{id} f{f}";
        var input = L(frame["in"]);
        var target = new Vec3(D(input[0]), D(input[1]), D(input[2]));
        double turn = D(input[3]), zoom = D(input[4]);
        bool musou = D(input[5]) != 0, title = D(input[6]) != 0;
        if (wasTitle && !title) rig.Snap(target, D(scenario["snapYaw"]));
        wasTitle = title;
        foreach (var e in pending)
          if (e.Frame == f)
          {
            if (e.Kind == "recenter") rig.Recenter(e.Value);
            else if (e.Kind == "trauma") rig.AddTrauma(e.Value);
            else if (e.Kind == "kick") rig.Kick(e.Value);
          }
        rig.Update(dt, target, turn, zoom, musou, title, f * dt);
        RoofCutaway.Update(roofs, target.X, target.Z, title);

        result.Number(at + " yaw", D(frame["yaw"]), rig.Yaw, Tolerance);
        result.Number(at + " distance", D(frame["distance"]), rig.Distance, Tolerance);
        Vector(result, at + " focus", frame["focus"], rig.Focus);
        var fwd = L(frame["fwd"]);
        result.Number(at + " forward.x", D(fwd[0]), rig.Forward.X, Tolerance);
        result.Number(at + " forward.z", D(fwd[1]), rig.Forward.Z, Tolerance);
        Vector(result, at + " pos", frame["pos"], rig.Position);
        Vector(result, at + " up", frame["up"], rig.Up);
        var q = L(frame["q"]);
        double dot = Math.Abs(D(q[0]) * rig.Rotation.X + D(q[1]) * rig.Rotation.Y + D(q[2]) * rig.Rotation.Z + D(q[3]) * rig.Rotation.W);
        result.Number(at + " rotation", 1, dot, QuaternionTolerance);
        result.Number(at + " fov", D(frame["fov"]), rig.Fov, Tolerance);
        var st = L(frame["st"]);
        result.Number(at + " trauma", D(st[0]), rig.Trauma, Tolerance);
        result.Number(at + " punch", D(st[1]), rig.Punch, Tolerance);
        result.Number(at + " musou", D(st[2]), rig.Musou, Tolerance);
        result.Number(at + " title", D(st[3]), rig.Title, Tolerance);
        result.Number(at + " zoomed", D(st[4]), rig.ZoomedDistance, Tolerance);
        result.Number(at + " recenter", D(st[5]), rig.RecenterYaw ?? -99, Tolerance);
        result.Number(at + " focusDistance", D(st[6]), rig.FocusDistance, 1e-5);
        var expectedRoofs = L(frame["roofs"]);
        for (int i = 0; i < roofs.Length; i++) result.Number($"{at} roof {i}", D(expectedRoofs[i]), roofs[i] ? 1 : 0, 0);
        result.Frames++;
      }
      return result;
    }

    // The fixture records recenter/trauma/kick as scenario inputs by frame (resolved by the Web generator); the
    // scenario table mirrors scripts/lib/camera-parity.ts CAMERA_SCENARIOS so the replay issues the same calls.
    struct Event { public int Frame; public string Kind; public double Value; }

    static List<Event> Events(Dictionary<string, object> scenario)
    {
      var list = new List<Event>();
      double hz = D(scenario["hz"]);
      int FrameOf(double t) => Math.Max(0, (int)Math.Ceiling(t * hz - 1e-9));
      if ((string)scenario["id"] == "open_turn_zoom")
      {
        list.Add(new Event { Frame = FrameOf(2.5), Kind = "recenter", Value = 1.0 });
        list.Add(new Event { Frame = FrameOf(3.0), Kind = "trauma", Value = 0.6 });
        list.Add(new Event { Frame = FrameOf(3.2), Kind = "kick", Value = 0.5 });
      }
      return list;
    }

    static void Vector(CombatParity.Result result, string at, object expected, Vec3 actual)
    {
      var v = L(expected);
      result.Number(at + ".x", D(v[0]), actual.X, Tolerance);
      result.Number(at + ".y", D(v[1]), actual.Y, Tolerance);
      result.Number(at + ".z", D(v[2]), actual.Z, Tolerance);
    }

    public static CombatParity.Result CompareSamples(Dictionary<string, object> fixture)
    {
      var result = new CombatParity.Result();
      var constants = O(fixture["constants"]);
      result.Number("playLimit", D(constants["playLimit"]), CastleGeometry.PlayLimit, 0);
      result.Number("roofOverhang", D(constants["roofOverhang"]), CastleGeometry.BarracksRoofOverhang, 1e-12);
      var barracks = L(constants["barracks"]);
      for (int i = 0; i < barracks.Count; i++)
      {
        var b = L(barracks[i]);
        var r = CastleGeometry.Barracks[i];
        result.Number($"barracks {i}", D(b[0]) + D(b[1]) * 1e3 + D(b[2]) * 1e6 + D(b[3]) * 1e9, r.MinX + r.MaxX * 1e3 + r.MinZ * 1e6 + r.MaxZ * 1e9, 0);
      }
      foreach (var c in L(fixture["clearance"]))
      {
        var v = L(c);
        result.Number($"clearance ({F(D(v[0]))},{F(D(v[1]))})->({F(D(v[2]))},{F(D(v[3]))})", D(v[4]), CameraClearance.Clearance(D(v[0]), D(v[1]), D(v[2]), D(v[3])), 1e-12);
      }
      foreach (var o in L(fixture["overhang"]))
      {
        var v = L(o);
        double x = D(v[0]), z = D(v[1]);
        CameraClearance.ClearOverhang(ref x, ref z);
        result.Number($"overhang ({F(D(v[0]))},{F(D(v[1]))}).x", D(v[2]), x, 1e-12);
        result.Number($"overhang ({F(D(v[0]))},{F(D(v[1]))}).z", D(v[3]), z, 1e-12);
      }
      var roofs = new bool[CastleGeometry.Barracks.Count];
      for (int i = 0; i < roofs.Length; i++) roofs[i] = true;
      int step = 0;
      foreach (var c in L(fixture["cutaway"]))
      {
        var v = L(c);
        RoofCutaway.Update(roofs, D(v[0]), D(v[1]), D(v[2]) != 0);
        for (int i = 0; i < roofs.Length; i++) result.Number($"cutaway step {step} roof {i}", D(v[3 + i]), roofs[i] ? 1 : 0, 0);
        step++;
      }
      foreach (var c in L(fixture["controls"]))
      {
        var v = L(c);
        var frame = new InputFrame { MoveX = D(v[1]), MoveY = D(v[2]), Attack = D(v[1]) == 1, Guard = D(v[2]) == 1 };
        var controls = ControlComposer.Compose(frame, D(v[0]));
        string at = $"controls yaw {F(D(v[0]))} ({F(D(v[1]))},{F(D(v[2]))})";
        result.Number(at + " moveX", D(v[3]), controls.MoveX, Tolerance);
        result.Number(at + " moveZ", D(v[4]), controls.MoveZ, Tolerance);
        result.Number(at + " attack", D(v[5]), controls.Attack ? 1 : 0, 0);
        result.Number(at + " guard", D(v[6]), controls.Guard ? 1 : 0, 0);
      }
      return result;
    }
  }
}
