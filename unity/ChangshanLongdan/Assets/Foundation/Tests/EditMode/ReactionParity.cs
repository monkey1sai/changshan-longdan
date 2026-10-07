using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  // E07: replays TestData/combat/web-reactions.json (the Web soldier reactions, the player's hurt loop and the
  // presentation events) through CombatSimulation and compares every recorded frame.
  public static class ReactionParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-reactions.json";
    // Float32 state printed to 1e-6. Transcendental functions differ by an ULP between runtimes, and a radial hit or the
    // separation push normalises a short vector (dx / d), which amplifies a one-ULP position difference into the
    // velocity: the musou crowd drifts up to 4.5e-5 m over four seconds. States, lives, health and hit lists are exact.
    public const double FloatTolerance = 1e-4;
    public const uint BlowStampBase = 1_000_000; // second-source stamps never collide with the player's

    public sealed class Replay
    {
      public readonly CombatParity.Result Result = new CombatParity.Result();
      public readonly HashSet<EnemyState> StatesSeen = new HashSet<EnemyState>();
      public readonly List<string> EventTypes = new List<string>();
    }

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;
    static double D(object o) => o is bool b ? (b ? 1 : 0) : (double)o;
    static bool B(object o) => o is bool b ? b : (double)o != 0;
    static string I(double v) => ((long)v).ToString(CultureInfo.InvariantCulture);
    static int FrameOf(double t, double hz) => Math.Max(0, (int)Math.Ceiling(t * hz - 1e-9));

    public static Dictionary<string, object> Load(string repoRoot) =>
      (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(Path.Combine(repoRoot, FixturePath)));

    public static IEnumerable<Dictionary<string, object>> Scenarios(Dictionary<string, object> fixture)
    {
      foreach (var s in L(fixture["scenarios"])) yield return O(s);
    }

    static readonly Dictionary<HitWindow, string> windowKeys = BuildWindowKeys();

    static Dictionary<HitWindow, string> BuildWindowKeys()
    {
      var map = new Dictionary<HitWindow, string>();
      foreach (var id in (MoveId[])Enum.GetValues(typeof(MoveId)))
      {
        var hits = Moves.Get(id).Hits;
        for (int i = 0; i < hits.Count; i++) map[hits[i]] = $"{id}:{i.ToString(CultureInfo.InvariantCulture)}";
      }
      return map;
    }

    static HitWindow WindowOf(string key)
    {
      var parts = key.Split(':');
      return Moves.Get((MoveId)Enum.Parse(typeof(MoveId), parts[0])).Hits[int.Parse(parts[1], CultureInfo.InvariantCulture)];
    }

    public static HitTargets Targets(Dictionary<string, object> scenario)
    {
      var spawns = L(scenario["spawns"]);
      var targets = new HitTargets(spawns.Count) { AiEnabled = false }; // the E07 harness replays the reactions without the AI
      var list = new List<Spawn>();
      foreach (var item in spawns)
      {
        var s = O(item);
        list.Add(new Spawn(D(s["x"]), D(s["z"]), D(s["yaw"]), (EnemyKind)(int)D(s["kind"])));
      }
      targets.Reset(list);
      for (int i = 0; i < spawns.Count; i++)
      {
        var s = O(spawns[i]);
        if (s["y"] != null) targets.SetY(i, D(s["y"]));
        if (s["scale"] != null) targets.SetScale(i, D(s["scale"]));
        if (s["hp"] != null) targets.SetHp(i, (float)D(s["hp"]));
      }
      targets.RebuildHash();
      return targets;
    }

    public static Replay Run(Dictionary<string, object> scenario)
    {
      var replay = new Replay();
      var result = replay.Result;
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      var targets = Targets(scenario);
      var sim = new CombatSimulation(targets);
      sim.Restart();
      if (scenario["playerHp"] != null) sim.Player.SetHp(D(scenario["playerHp"]));
      if (D(scenario["gain"]) > 0) sim.Player.GainMusou(D(scenario["gain"]));
      var holds = L(scenario["holds"]);
      var presses = L(scenario["presses"]);
      var blows = L(scenario["blows"]);
      var strikes = L(scenario["strikes"]);
      var recorded = new Dictionary<int, Dictionary<string, object>>();
      foreach (var f in L(scenario["frames"]))
      {
        var frame = O(f);
        recorded[(int)D(frame["f"])] = frame;
      }
      var labels = new Dictionary<uint, string>();
      uint blowStamp = BlowStampBase;
      int next = 0, started = 0;
      var actual = new List<List<object>>();
      var frameBlows = new List<Dictionary<string, object>>();
      int frames = (int)Math.Round(D(scenario["duration"]) * hz);
      for (int frame = 0; frame < frames; frame++)
      {
        double t = frame * dt;
        var controls = new PlayerControls();
        foreach (var h in holds)
        {
          var hold = O(h);
          if (t + 1e-9 < D(hold["from"]) || t + 1e-9 >= D(hold["to"])) continue;
          if (hold.TryGetValue("guard", out var g) && B(g)) controls.Guard = true;
          if (hold.TryGetValue("move", out var m) && m != null)
          {
            controls.MoveX = D(L(m)[0]);
            controls.MoveZ = D(L(m)[1]);
          }
        }
        if (next < presses.Count)
        {
          var press = L(presses[next]);
          double after = D(press[1]);
          if (next == 0 || (started >= next && sim.Clock.Hitstop <= 0 && sim.Player.MoveTime >= after))
          {
            switch ((string)press[0])
            {
              case "attack": controls.Attack = true; break;
              case "charge": controls.Charge = true; break;
              case "jump": controls.Jump = true; break;
              case "dodge": controls.Dodge = true; break;
              case "musou": controls.Musou = true; break;
            }
            next++;
          }
        }
        frameBlows.Clear();
        foreach (var b in blows) if (FrameOf(D(O(b)["at"]), hz) == frame) frameBlows.Add(O(b));
        Action<double> second = frameBlows.Count == 0 ? null : (Action<double>)(_ =>
        {
          foreach (var b in frameBlows) sim.ApplyExternal(++blowStamp, WindowOf((string)b["window"]), D(b["x"]), D(b["y"]), D(b["z"]), D(b["facing"]));
        });
        actual.Clear();
        if (sim.Step(dt, controls, second))
        {
          foreach (var e in sim.Player.Events) if (e.Type == PlayerEventType.MoveStart) started++;
          Collect(sim, actual, labels);
        }
        foreach (var s in strikes)
        {
          var strike = O(s);
          if (FrameOf(D(strike["at"]), hz) != frame) continue;
          sim.InjectStrike(new EnemyStrike(D(strike["damage"]), B(strike["heavy"]), D(strike["x"]), D(strike["z"])));
          Collect(sim, actual, labels);
        }
        foreach (var row in actual) replay.EventTypes.Add((string)row[0]);
        for (int i = 0; i < targets.Count; i++) replay.StatesSeen.Add(targets.State(i));
        if (!recorded.TryGetValue(frame, out var expected)) continue;
        result.Frames++;
        string at = $"{scenario["id"]}@{hz}Hz frame {frame}";
        Compare(result, at, expected, sim, targets, actual);
      }
      if (next != presses.Count) result.Fail($"{scenario["id"]}@{hz}: only {next} of {presses.Count} presses happened");
      return replay;
    }

    // This frame's events in Battle's order as the fixture records them (player hits, second-source blows, kills,
    // then the injected strike's outcome).
    static void Collect(CombatSimulation sim, List<List<object>> rows, Dictionary<uint, string> labels)
    {
      foreach (var e in sim.Events)
      {
        var row = new List<object>();
        switch (e.Type)
        {
          case CombatEventType.Hit:
          {
            string key = windowKeys[e.Window];
            if (e.Source == HitSource.Player)
            {
              // Like the Web harness, a window instance is named when it first hits someone.
              uint stamp = sim.Hits[e.Start].Stamp;
              if (!labels.ContainsKey(stamp)) labels[stamp] = "P" + (labels.Count + 1).ToString(CultureInfo.InvariantCulture);
              row.Add("hit");
              row.Add($"{labels[stamp]}={key}");
            }
            else
            {
              row.Add("blow");
              row.Add(key);
            }
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var h = sim.Hits[i];
              row.Add(new List<object> { (double)h.Target, h.Killed ? 1.0 : 0.0, (double)h.HpAfter, h.X, h.Y, h.Z, h.DirX, h.DirZ });
            }
            break;
          }
          case CombatEventType.Kill:
            row.Add("kill");
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var k = sim.Kills[i];
              row.Add(new List<object> { (double)k.Id, k.X, k.Y, k.Z, k.Vx, k.Vy, k.Vz, k.Yaw, k.Spin, (double)(int)k.Kind });
            }
            break;
          case CombatEventType.EnemyStrike: row.AddRange(new object[] { "enemyStrike", e.X, e.Z, e.Heavy ? 1.0 : 0.0 }); break;
          case CombatEventType.Parry: row.AddRange(new object[] { "parry", e.X, e.Z, e.Facing }); break;
          case CombatEventType.GuardBlock: row.AddRange(new object[] { "guardBlock", e.X, e.Z, e.Facing, e.Heavy ? 1.0 : 0.0, e.Damage }); break;
          case CombatEventType.Hurt: row.AddRange(new object[] { "hurt", e.X, e.Z, e.Heavy ? 1.0 : 0.0 }); break;
          case CombatEventType.MusouReady: continue; // the reaction harness does not record it (web-presentation.json does)
          case CombatEventType.Phase: continue; // unreachable with AI off, ignored like the Web harness
          default: continue;
        }
        rows.Add(row);
      }
    }

    static void Compare(CombatParity.Result result, string at, Dictionary<string, object> frame, CombatSimulation sim, HitTargets targets, List<List<object>> actual)
    {
      var p = sim.Player;
      var s = L(frame["s"]);
      result.Text(at + " state", (string)s[0], p.State.ToString().ToLowerInvariant());
      result.Text(at + " move", (string)s[1], p.Move == null ? "" : p.Move.Id.ToString());
      double[] values = { p.MoveTime, p.X, p.Y, p.Z, p.Facing, p.Musou, p.Hp, p.Invulnerable };
      string[] names = { "moveTime", "x", "y", "z", "facing", "musou", "hp", "invuln" };
      for (int i = 0; i < values.Length; i++) result.Number($"{at} {names[i]}", D(s[i + 2]), values[i], CombatParity.ContinuousTolerance);
      result.Number(at + " hitstop", D(frame["hs"]), sim.Clock.Hitstop, CombatParity.ContinuousTolerance);

      var expectedEvents = frame.TryGetValue("e", out var ev) ? L(ev) : new List<object>();
      if (expectedEvents.Count != actual.Count)
      {
        result.Fail($"{at} events: expected {expectedEvents.Count}, got {actual.Count} ({string.Join(" ", actual.ConvertAll(r => (string)r[0]))})");
      }
      else
      {
        for (int i = 0; i < actual.Count; i++)
        {
          var e = L(expectedEvents[i]);
          var a = actual[i];
          string where = $"{at} event {i}";
          result.Text(where + " type", (string)e[0], (string)a[0]);
          if (e.Count != a.Count)
          {
            result.Fail($"{where}: expected {e.Count} fields, got {a.Count}");
            continue;
          }
          for (int k = 1; k < e.Count; k++)
          {
            if (e[k] is string es) result.Text($"{where} field {k}", es, (string)a[k]);
            else if (e[k] is List<object> el)
            {
              var al = (List<object>)a[k];
              for (int j = 0; j < el.Count; j++) result.Number($"{where} field {k}.{j}", D(el[j]), (double)al[j], j == 0 ? 0 : FloatTolerance);
            }
            else result.Number($"{where} field {k}", D(e[k]), (double)a[k], FloatTolerance);
          }
        }
      }

      var soldiers = L(frame["n"]);
      if (soldiers.Count != targets.Count)
      {
        result.Fail($"{at} soldiers: expected {soldiers.Count}, got {targets.Count}");
        return;
      }
      for (int i = 0; i < soldiers.Count; i++)
      {
        var n = L(soldiers[i]);
        string where = $"{at} soldier {i}";
        result.Text(where + " state", I(D(n[0])), ((int)targets.State(i)).ToString(CultureInfo.InvariantCulture));
        result.Text(where + " alive", I(D(n[1])), targets.Alive(i) ? "1" : "0");
        result.Number(where + " hp", D(n[2]), targets.Hp(i), 0);
        double[] v = { targets.X(i), targets.Y(i), targets.Z(i), targets.Vx(i), targets.Vy(i), targets.Vz(i), targets.Yaw(i), targets.Spin(i), targets.SpinVel(i), targets.Flash(i), targets.StateTime(i) };
        string[] vn = { "x", "y", "z", "vx", "vy", "vz", "yaw", "spin", "spinVel", "flash", "stateTime" };
        for (int k = 0; k < v.Length; k++) result.Number($"{where} {vn[k]}", D(n[k + 3]), v[k], FloatTolerance);
      }
    }
  }
}
