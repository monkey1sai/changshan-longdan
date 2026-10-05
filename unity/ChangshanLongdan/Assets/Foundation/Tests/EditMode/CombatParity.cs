using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  // Replays the Web-generated fixture (scripts/combat-parity.mjs) through the C# port and lists every difference.
  // Discrete values (state, move, events, active windows, counts) must match exactly; continuous values within
  // ContinuousTolerance, declared before the comparison because sin/cos/exp/atan2 may differ in the last bit.
  public static class CombatParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-parity.json";
    public const double ContinuousTolerance = 1e-6;
    public const double DataTolerance = 1e-12;

    public sealed class Result
    {
      public int Frames;
      public double MaxDeviation;
      public int FailCount;
      public readonly List<string> Mismatches = new List<string>();

      public void Fail(string message)
      {
        FailCount++;
        if (Mismatches.Count < 12) Mismatches.Add(message);
      }

      public void Number(string where, double expected, double actual, double tolerance)
      {
        double deviation = Math.Abs(expected - actual);
        if (double.IsNaN(deviation)) deviation = double.PositiveInfinity;
        if (deviation > MaxDeviation) MaxDeviation = deviation;
        if (deviation > tolerance) Fail($"{where}: expected {R(expected)}, got {R(actual)}");
      }

      public void Text(string where, string expected, string actual)
      {
        if (expected != actual) Fail($"{where}: expected '{expected}', got '{actual}'");
      }

      public void Merge(string scope, Result other)
      {
        Frames += other.Frames;
        MaxDeviation = Math.Max(MaxDeviation, other.MaxDeviation);
        FailCount += other.FailCount;
        foreach (var m in other.Mismatches) if (Mismatches.Count < 12) Mismatches.Add(scope + " " + m);
      }

      public override string ToString() =>
        $"frames={Frames} failures={FailCount} maxDeviation={R(MaxDeviation)}" + (Mismatches.Count > 0 ? "\n" + string.Join("\n", Mismatches) : "");
    }

    public static string RepoRoot(string unityProjectPath) => Path.GetFullPath(Path.Combine(unityProjectPath, "..", ".."));

    public static Dictionary<string, object> Load(string repoRoot) =>
      (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(Path.Combine(repoRoot, FixturePath)));

    public static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;
    static double D(object o) => o is bool b ? (b ? 1 : 0) : (double)o;
    static bool B(object o) => o is bool b ? b : (double)o != 0;

    // The fixture was generated from these Web files; a hash change means it must be regenerated.
    public static Result CompareSources(Dictionary<string, object> fixture, string repoRoot)
    {
      var result = new Result();
      using (var sha = SHA256.Create())
        foreach (var entry in O(fixture["sources"]))
        {
          string file = Path.Combine(repoRoot, entry.Key);
          if (!File.Exists(file)) { result.Fail($"source missing: {entry.Key}"); continue; }
          string actual = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-", "").ToLowerInvariant();
          result.Text("source " + entry.Key, (string)entry.Value, actual);
        }
      return result;
    }

    public static Result CompareConstants(Dictionary<string, object> fixture)
    {
      var result = new Result();
      var c = O(fixture["constants"]);
      result.Number("playLimit", D(c["playLimit"]), ArenaLayout.PlayLimit, DataTolerance);
      var start = O(c["playerStart"]);
      result.Number("start.x", D(start["x"]), ArenaLayout.StartX, DataTolerance);
      result.Number("start.z", D(start["z"]), ArenaLayout.StartZ, DataTolerance);
      result.Number("start.facing", D(start["facing"]), ArenaLayout.StartFacing, DataTolerance);
      result.Number("musouMax", D(c["musouMax"]), PlayerTuning.Default.MusouMax, DataTolerance);
      var expected = L(c["obstacles"]);
      var actual = ArenaLayout.Obstacles();
      if (expected.Count != actual.Length) result.Fail($"obstacle count: expected {expected.Count}, got {actual.Length}");
      for (int i = 0; i < Math.Min(expected.Count, actual.Length); i++)
      {
        var e = L(expected[i]);
        result.Number($"obstacle[{i}].minX", D(e[0]), actual[i].MinX, DataTolerance);
        result.Number($"obstacle[{i}].maxX", D(e[1]), actual[i].MaxX, DataTolerance);
        result.Number($"obstacle[{i}].minZ", D(e[2]), actual[i].MinZ, DataTolerance);
        result.Number($"obstacle[{i}].maxZ", D(e[3]), actual[i].MaxZ, DataTolerance);
      }
      return result;
    }

    public static Result CompareMoves(Dictionary<string, object> fixture)
    {
      var result = new Result();
      var moves = O(fixture["moves"]);
      var ids = new List<string>(moves.Keys);
      if (ids.Count != Moves.All.Count) result.Fail($"move count: expected {ids.Count}, got {Moves.All.Count}");
      for (int index = 0; index < ids.Count; index++)
      {
        string id = ids[index];
        if (!Enum.TryParse(id, out MoveId moveId) || (int)moveId != index) { result.Fail($"move {id} missing or out of order"); continue; }
        var e = O(moves[id]);
        var m = Moves.Get(moveId);
        string at = "move " + id;
        result.Text(at + ".name", (string)e["name"], m.Name);
        result.Number(at + ".duration", D(e["duration"]), m.Duration, DataTolerance);
        result.Number(at + ".cancel", D(e["cancel"]), m.Cancel, DataTolerance);
        result.Text(at + ".armor", B(e["armor"]).ToString(), m.Armor.ToString());
        result.Text(at + ".airborne", B(e["airborne"]).ToString(), m.Airborne.ToString());
        var hits = L(e["hits"]);
        if (hits.Count != m.Hits.Count) { result.Fail($"{at}.hits count: expected {hits.Count}, got {m.Hits.Count}"); continue; }
        for (int i = 0; i < hits.Count; i++)
        {
          var h = O(hits[i]);
          var w = m.Hits[i];
          string hw = $"{at}.hits[{i}]";
          result.Number(hw + ".t0", D(h["t0"]), w.T0, DataTolerance);
          result.Number(hw + ".t1", D(h["t1"]), w.T1, DataTolerance);
          result.Text(hw + ".kind", (string)h["kind"], w.Shape.Kind.ToString().ToLowerInvariant());
          result.Number(hw + ".range", D(h["range"]), w.Shape.Range, DataTolerance);
          result.Number(hw + ".offset", D(h["offset"]), w.Shape.Offset, DataTolerance);
          result.Number(hw + ".halfAngle", D(h["halfAngle"]), w.Shape.HalfAngle, DataTolerance);
          result.Number(hw + ".width", D(h["width"]), w.Shape.Width, DataTolerance);
          result.Number(hw + ".damage", D(h["damage"]), w.Damage, DataTolerance);
          result.Text(hw + ".reaction", (string)h["reaction"], w.Reaction.ToString().ToLowerInvariant());
          result.Number(hw + ".push", D(h["push"]), w.Push, DataTolerance);
          result.Number(hw + ".lift", D(h["lift"]), w.Lift, DataTolerance);
          result.Number(hw + ".hitstop", D(h["hitstop"]), w.Hitstop, DataTolerance);
          result.Number(hw + ".shake", D(h["shake"]), w.Shake, DataTolerance);
          result.Text(hw + ".sfx", (string)h["sfx"], w.Sfx.ToString().ToLowerInvariant());
          result.Text(hw + ".radial", B(h["radial"]).ToString(), w.Radial.ToString());
          result.Text(hw + ".yMin", h["yMin"] == null ? "" : R(D(h["yMin"])), w.YMin.HasValue ? R(w.YMin.Value) : "");
          result.Text(hw + ".yMax", h["yMax"] == null ? "" : R(D(h["yMax"])), w.YMax.HasValue ? R(w.YMax.Value) : "");
          result.Text(hw + ".fx", (string)h["fx"], w.Fx == HitFx.None ? "" : w.Fx.ToString().ToLowerInvariant());
        }
        var lunges = L(e["lunge"]);
        if (lunges.Count != m.Lunges.Count) result.Fail($"{at}.lunge count: expected {lunges.Count}, got {m.Lunges.Count}");
        else for (int i = 0; i < lunges.Count; i++)
        {
          var l = L(lunges[i]);
          result.Number($"{at}.lunge[{i}].t0", D(l[0]), m.Lunges[i].T0, DataTolerance);
          result.Number($"{at}.lunge[{i}].t1", D(l[1]), m.Lunges[i].T1, DataTolerance);
          result.Number($"{at}.lunge[{i}].distance", D(l[2]), m.Lunges[i].Distance, DataTolerance);
        }
        var trail = L(e["trail"]);
        if (trail.Count != m.Trail.Count) result.Fail($"{at}.trail count: expected {trail.Count}, got {m.Trail.Count}");
        else for (int i = 0; i < trail.Count; i++)
        {
          result.Number($"{at}.trail[{i}].start", D(L(trail[i])[0]), m.Trail[i].Start, DataTolerance);
          result.Number($"{at}.trail[{i}].end", D(L(trail[i])[1]), m.Trail[i].End, DataTolerance);
        }
        var swings = L(e["swings"]);
        if (swings.Count != m.Swings.Count) result.Fail($"{at}.swings count: expected {swings.Count}, got {m.Swings.Count}");
        else for (int i = 0; i < swings.Count; i++) result.Number($"{at}.swings[{i}]", D(swings[i]), m.Swings[i], DataTolerance);
        if (e["height"] == null)
        {
          if (m.HasHeight) result.Fail($"{at}.height: expected none");
        }
        else
        {
          var height = O(e["height"]);
          var keys = L(height["keys"]);
          result.Text(at + ".height.relative", B(height["relative"]).ToString(), m.HeightRelative.ToString());
          if (keys.Count != m.HeightKeyCount) result.Fail($"{at}.height count: expected {keys.Count}, got {m.HeightKeyCount}");
          else for (int i = 0; i < keys.Count; i++)
          {
            var (time, value) = m.HeightKey(i);
            result.Number($"{at}.height[{i}].t", D(L(keys[i])[0]), time, DataTolerance);
            result.Number($"{at}.height[{i}].v", D(L(keys[i])[1]), value, DataTolerance);
          }
        }
      }
      return result;
    }

    // Web inHitShape/shapeReach sampled on an exact grid; every sample must agree.
    public static Result CompareHitShapes(Dictionary<string, object> fixture)
    {
      var result = new Result();
      foreach (var item in L(fixture["hitShapes"]))
      {
        var h = O(item);
        var kind = (HitShapeKind)Enum.Parse(typeof(HitShapeKind), (string)h["kind"], ignoreCase: true);
        var shape = HitShape.FromRadians(kind, D(h["range"]), D(h["halfAngle"]), D(h["width"]), D(h["offset"]));
        double facing = D(h["facing"]), step = D(h["step"]);
        var origin = L(h["origin"]);
        double ox = D(origin[0]), oz = D(origin[1]);
        int grid = (int)D(h["grid"]);
        var radii = L(h["radii"]);
        string bits = (string)h["bits"];
        string at = $"shape {h["kind"]} r{R(shape.Range)} off{R(shape.Offset)} f{R(facing)}";
        result.Number(at + " reach", D(h["reach"]), shape.Reach, ContinuousTolerance);
        int expectedBits = (2 * grid + 1) * (2 * grid + 1) * radii.Count;
        if (bits.Length != expectedBits)
        {
          result.Fail($"{at}: {bits.Length} samples, expected {expectedBits}");
          continue;
        }
        int k = 0;
        for (int i = -grid; i <= grid; i++)
          for (int j = -grid; j <= grid; j++)
            foreach (var radius in radii)
            {
              bool expected = bits[k++] == '1';
              bool actual = shape.Contains(ox, oz, facing, ox + i * step, oz + j * step, D(radius));
              if (expected != actual) result.Fail($"{at} i{i} j{j} radius {R(D(radius))}: expected {expected}, got {actual}");
              result.Frames++;
            }
        if (k != bits.Length) result.Fail($"{at}: {bits.Length - k} unread samples");
      }
      return result;
    }

    public static string EventText(PlayerEvent e)
    {
      switch (e.Type)
      {
        case PlayerEventType.MoveStart: return "moveStart:" + e.Move;
        case PlayerEventType.Swing: return "swing:" + (e.Heavy ? 1 : 0);
        case PlayerEventType.Land: return "land:" + (e.Heavy ? 1 : 0);
        case PlayerEventType.Hurt: return "hurt:" + (e.Heavy ? 1 : 0);
        case PlayerEventType.GuardBlock: return $"guardBlock:{R(e.Damage)}:{(e.Heavy ? 1 : 0)}";
        case PlayerEventType.Fx: return $"fx:{e.Fx.ToString().ToLowerInvariant()}:{R(e.Radius)}";
        default:
          string name = e.Type.ToString();
          return char.ToLowerInvariant(name[0]) + name.Substring(1);
      }
    }

    static string Join(IReadOnlyList<PlayerEvent> events, int from = 0)
    {
      var parts = new List<string>();
      for (int i = from; i < events.Count; i++) parts.Add(EventText(events[i]));
      return string.Join(",", parts);
    }

    static string JoinStrings(object list)
    {
      var parts = new List<string>();
      foreach (var o in L(list)) parts.Add(o is string s ? s : R(D(o)));
      return string.Join(",", parts);
    }

    public static Result ReplayPlayer(Dictionary<string, object> trace, PlayerTuning tuning = null)
    {
      var result = new Result();
      double hz = D(trace["hz"]);
      double dt = 1 / hz;
      var driver = new PlayerDriver(new Player(tuning), ArenaLayout.CreateArena());
      driver.Restart();
      // Same fixed-target auto-aim as the generator: the target is returned only when within the requested distance.
      AimFunction aim = null;
      if (trace.TryGetValue("aim", out var aimTarget) && aimTarget != null)
      {
        double ax = D(L(aimTarget)[0]), az = D(L(aimTarget)[1]);
        aim = (double x, double z, double maxDistance, out double tx, out double tz) =>
        {
          tx = ax;
          tz = az;
          return CombatMath.Hypot(ax - x, az - z) <= maxDistance;
        };
      }
      var frames = L(trace["frames"]);
      for (int f = 0; f < frames.Count; f++)
      {
        var frame = O(frames[f]);
        string at = $"{trace["id"]}@{hz}Hz frame {f}";
        if (frame.TryGetValue("op", out var ops))
        {
          foreach (var item in L(ops))
          {
            var op = L(item);
            switch ((string)op[0])
            {
              case "hitstop": driver.AddHitstop(D(op[1])); break;
              case "clear": driver.Interrupt(); break;
              case "hit": driver.Player.TakeHit(D(op[1]), B(op[2]), D(op[3]), D(op[4])); break;
              case "gain": driver.Player.GainMusou(D(op[1])); break;
              case "reset": driver.Restart(); break;
              default: result.Fail($"{at}: unknown op {op[0]}"); break;
            }
          }
          result.Text(at + " op events", JoinStrings(frame["oe"]), Join(driver.Player.Events));
        }
        var c = L(frame["c"]);
        var controls = new PlayerControls
        {
          MoveX = D(c[0]), MoveZ = D(c[1]), Attack = B(c[2]), Charge = B(c[3]), Jump = B(c[4]), Dodge = B(c[5]), Musou = B(c[6]), Guard = B(c[7]),
        };
        driver.Step(dt, controls, aim);
        var p = driver.Player;
        var s = L(frame["s"]);
        result.Text(at + " state", (string)s[0], p.State.ToString().ToLowerInvariant());
        result.Text(at + " move", (string)s[1], p.Move == null ? "" : p.Move.Id.ToString());
        double[] actual =
        {
          p.MoveTime, p.StateTime, p.X, p.Y, p.Z, p.VelocityX, p.VelocityY, p.VelocityZ, p.Facing, p.Hp, p.Musou, p.Invulnerable,
          p.NormalCount, p.CounterReady, p.ParryTimer, p.GuardTimer, p.Speed, p.RunPhase, p.DodgeBack ? 1 : 0,
        };
        string[] names =
        {
          "moveTime", "stateTime", "x", "y", "z", "vx", "vy", "vz", "facing", "hp", "musou", "invuln", "normalCount", "counterReady",
          "parryTimer", "guardTimer", "speed", "runPhase", "dodgeBack",
        };
        for (int i = 0; i < actual.Length; i++)
        {
          bool discrete = names[i] == "normalCount" || names[i] == "dodgeBack";
          result.Number($"{at} {names[i]}", D(s[i + 2]), actual[i], discrete ? 0 : ContinuousTolerance);
        }
        // During hit-stop the player does not update, so events from an op in the same frame are still listed.
        result.Text(at + " events", JoinStrings(frame["e"]), Join(p.Events));
        var windows = new List<string>();
        foreach (var hit in p.ActiveHits) windows.Add($"{hit.Move}:{hit.WindowIndex.ToString(CultureInfo.InvariantCulture)}");
        result.Text(at + " active windows", JoinStrings(frame["h"]), string.Join(",", windows));
        result.Frames++;
      }
      return result;
    }

    public static Result ReplayInput(Dictionary<string, object> trace, IReadOnlyList<double> yaws)
    {
      var result = new Result();
      double hz = D(trace["hz"]);
      double dt = 1 / hz;
      var mapper = new InputMapper();
      var frames = L(trace["frames"]);
      for (int f = 0; f < frames.Count; f++)
      {
        var frame = O(frames[f]);
        string at = $"{trace["id"]}@{hz}Hz frame {f}";
        if (frame.TryGetValue("ev", out var events))
          foreach (var item in L(events))
          {
            var ev = L(item);
            switch ((string)ev[0])
            {
              case "down": mapper.KeyDown((string)ev[1]); break;
              case "repeat": mapper.KeyDown((string)ev[1], repeat: true); break;
              case "up": mapper.KeyUp((string)ev[1]); break;
              case "mousedown": mapper.MouseDown((int)D(ev[1])); break;
              case "mouseup": mapper.MouseUp((int)D(ev[1])); break;
              case "blur": mapper.Blur(); break;
              default: result.Fail($"{at}: unknown event {ev[0]}"); break;
            }
          }
        var input = mapper.Poll(dt);
        var o = L(frame["out"]);
        result.Number(at + " moveX", D(o[0]), input.MoveX, ContinuousTolerance);
        result.Number(at + " moveY", D(o[1]), input.MoveY, ContinuousTolerance);
        bool[] buttons = { input.Attack, input.Charge, input.Jump, input.Dodge, input.Musou, input.Guard };
        string[] names = { "attack", "charge", "jump", "dodge", "musou", "guard" };
        for (int i = 0; i < buttons.Length; i++) result.Text($"{at} {names[i]}", B(o[i + 2]).ToString(), buttons[i].ToString());
        var composed = L(frame["composed"]);
        for (int y = 0; y < yaws.Count; y++)
        {
          var controls = ControlComposer.Compose(input, yaws[y]);
          result.Number($"{at} yaw{y} moveX", D(L(composed[y])[0]), controls.MoveX, ContinuousTolerance);
          result.Number($"{at} yaw{y} moveZ", D(L(composed[y])[1]), controls.MoveZ, ContinuousTolerance);
        }
        result.Frames++;
      }
      return result;
    }

    public static IReadOnlyList<double> ComposeYaws(Dictionary<string, object> fixture)
    {
      var yaws = new List<double>();
      foreach (var y in L(O(fixture["constants"])["composeYaws"])) yaws.Add(D(y));
      return yaws;
    }

    public static IEnumerable<Dictionary<string, object>> PlayerTraces(Dictionary<string, object> fixture, double hz)
    {
      foreach (var t in L(fixture["player"])) if (D(O(t)["hz"]) == hz) yield return O(t);
    }

    public static IEnumerable<Dictionary<string, object>> InputTraces(Dictionary<string, object> fixture)
    {
      foreach (var t in L(fixture["input"])) yield return O(t);
    }

    // Move starts of a recorded trace as (time, id), time measured at the end of the frame that started the move.
    public static List<(double Time, string Id)> MoveStarts(Dictionary<string, object> trace)
    {
      double hz = D(trace["hz"]);
      var starts = new List<(double, string)>();
      var frames = L(trace["frames"]);
      for (int f = 0; f < frames.Count; f++)
        foreach (var e in L(O(frames[f])["e"]))
          if (e is string s && s.StartsWith("moveStart:", StringComparison.Ordinal)) starts.Add(((f + 1) / hz, s.Substring(10)));
      return starts;
    }
  }
}
