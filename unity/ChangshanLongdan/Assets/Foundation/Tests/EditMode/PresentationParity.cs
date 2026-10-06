using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Changshan.Combat;
using Changshan.Feedback;

namespace Changshan.Foundation.Tests
{
  // E07 feedback: replays TestData/combat/web-presentation.json (the unmodified Web Presentation, particle classes and
  // trail fed by the Web Battle's events) through FeedbackDirector and the ported simulations, frame by frame: every
  // output call with its arguments, the number of random draws, particle counts and sums, ring and pillar states, and
  // sparse full particle states. The events and their hit/kill data are inputs taken from the fixture, so this checks the
  // presentation port independently of the fight (the fight is checked by the reaction parity).
  public static class PresentationParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-presentation.json";
    public const double CallTolerance = 1e-9; // arguments are plain arithmetic on the recorded inputs
    // Particle values are Float32 (printed to 1e-5); a transcendental ULP can move a value by one Float32 step.
    public const double StateTolerance = 2e-5;
    public const double SumToleranceEach = 2e-5; // per summed value

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

    public static IEnumerable<Dictionary<string, object>> Trails(Dictionary<string, object> fixture)
    {
      foreach (var s in L(fixture["trail"])) yield return O(s);
    }

    public sealed class Replay
    {
      public readonly CombatParity.Result Result = new CombatParity.Result();
      public readonly Dictionary<string, int> Calls = new Dictionary<string, int>();
      public int Draws;
    }

    // The harness's post object always reads 0 (game.ts damps it elsewhere); only the values written are compared.
    sealed class ZeroPost : IPostSink
    {
      public double Aberration { get => 0; set { } }
      public double Radial { get => 0; set { } }
      public double Flash { get => 0; set { } }
    }

    sealed class FixedCamera : ICameraSink
    {
      public double PositionX { get; set; }
      public double PositionZ { get; set; }
      public double RightX { get; set; }
      public double RightZ { get; set; }
      public void AddTrauma(double amount) { }
      public void Kick(double amount) { }
    }

    sealed class NoSparks : ISparkSink
    {
      public void Burst(double x, double y, double z, double dirX, double dirZ, int n, bool heavy, Mulberry32 rng) { }
    }

    sealed class NoHud : IHudSink
    {
      public void ShowBanner(Banner banner, double seconds, bool gold) { }
      public void PlayCutin() { }
    }

    sealed class Source : IFeedbackSource
    {
      public readonly List<HitEvent> HitList = new List<HitEvent>();
      public readonly List<KillInfo> KillList = new List<KillInfo>();
      public IReadOnlyList<HitEvent> Hits => HitList;
      public IReadOnlyList<KillInfo> Kills => KillList;
      public double PlayerX { get; set; }
      public double PlayerY { get; set; }
      public double PlayerZ { get; set; }
      public double PlayerFacing { get; set; }
    }

    public static HitWindow WindowOf(string key)
    {
      var parts = key.Split(':');
      return Moves.Get((MoveId)Enum.Parse(typeof(MoveId), parts[0])).Hits[int.Parse(parts[1], CultureInfo.InvariantCulture)];
    }

    static HitFx FxOf(string name) => name == "shockwave" ? HitFx.Shockwave : name == "blast" ? HitFx.Blast : throw new FormatException(name);

    static FeedbackEvent EventOf(List<object> e)
    {
      string type = (string)e[0];
      switch (type)
      {
        case "swing": return new FeedbackEvent(FeedbackEventType.Swing, heavy: D(e[1]) != 0);
        case "jump": return new FeedbackEvent(FeedbackEventType.Jump);
        case "land": return new FeedbackEvent(FeedbackEventType.Land, heavy: D(e[1]) != 0);
        case "dodge": return new FeedbackEvent(FeedbackEventType.Dodge);
        case "musouStart": return new FeedbackEvent(FeedbackEventType.MusouStart);
        case "fx": return new FeedbackEvent(FeedbackEventType.Fx, fx: FxOf((string)e[1]), x: D(e[2]), z: D(e[3]), radius: D(e[4]));
        case "hit": return new FeedbackEvent(FeedbackEventType.Hit, window: WindowOf((string)e[1]), start: (int)D(e[2]), count: (int)D(e[3]));
        case "kill": return new FeedbackEvent(FeedbackEventType.Kill, start: (int)D(e[1]), count: (int)D(e[2]));
        case "enemyStrike": return new FeedbackEvent(FeedbackEventType.EnemyStrike, heavy: D(e[3]) != 0, x: D(e[1]), z: D(e[2]));
        case "hurt": return new FeedbackEvent(FeedbackEventType.Hurt, heavy: D(e[3]) != 0, x: D(e[1]), z: D(e[2]));
        case "parry": return new FeedbackEvent(FeedbackEventType.Parry, x: D(e[1]), z: D(e[2]), facing: D(e[3]));
        case "guardBlock":
          return new FeedbackEvent(FeedbackEventType.GuardBlock, heavy: D(e[4]) != 0, x: D(e[1]), z: D(e[2]), facing: D(e[3]), damage: D(e[5]));
        case "musouReady": return new FeedbackEvent(FeedbackEventType.MusouReady);
        default: throw new FormatException("unknown event " + type);
      }
    }

    // A Web call's arguments in the trace's numeric form.
    static double Arg(string name, int i, object value)
    {
      if (value is string s)
      {
        if (name == "audio.hit" && i == 0) return s == "light" ? (double)HitSfx.Light : s == "heavy" ? (double)HitSfx.Heavy : s == "pierce" ? (double)HitSfx.Pierce : double.NaN;
        if (name == "hud.showBanner" && i == 1) return s == "gold" ? 1 : 0;
        return double.NaN;
      }
      return D(value);
    }

    // tamper (tests): runs before each frame's presentation. dropBursts (tests): the sparks output ignores bursts.
    public static Replay Run(Dictionary<string, object> fixture, Dictionary<string, object> scenario, Action<FeedbackDirector, int> tamper = null,
      bool dropBursts = false)
    {
      var replay = new Replay();
      var result = replay.Result;
      var camera = O(fixture["camera"]);
      var sparks = new SparkField();
      var dust = new DustField();
      var waves = new ShockwaveSet();
      var fragments = new FragmentField(D(fixture["playLimit"]));
      var trace = new FeedbackTrace(64, 4096);
      var sinks = TracingSinks.Wrap(new FeedbackSinks
      {
        Audio = null, Sparks = dropBursts ? (ISparkSink)new NoSparks() : sparks, Dust = dust, Waves = waves, Fragments = fragments,
        Camera = new FixedCamera { PositionX = D(camera["x"]), PositionZ = D(camera["z"]), RightX = D(camera["rightX"]), RightZ = D(camera["rightZ"]) },
        Post = new ZeroPost(), Hud = new NoHud(),
      }, trace);
      var director = new FeedbackDirector(sinks);
      var expectedRng = new Mulberry32(FeedbackDirector.Seed);
      var source = new Source();
      var events = new List<FeedbackEvent>();
      var cues = new List<FeedbackCue>();
      string id = $"{(string)scenario["id"]}@{F(D(scenario["hz"]))}";
      foreach (var frameObject in L(scenario["frames"]))
      {
        var frame = O(frameObject);
        int f = (int)D(frame["f"]);
        string at = $"{id} f{f}";
        double dt = D(frame["dt"]);
        var p = L(frame["p"]);
        source.PlayerX = D(p[0]);
        source.PlayerY = D(p[1]);
        source.PlayerZ = D(p[2]);
        source.PlayerFacing = D(p[3]);
        source.HitList.Clear();
        source.KillList.Clear();
        events.Clear();
        if (frame.TryGetValue("e", out var eventList))
        {
          foreach (var h in L(frame["h"]))
          {
            var v = L(h);
            source.HitList.Add(new HitEvent(0, 0, HitSource.Player, 0, null, 0, 0, 0, 0, false, D(v[3]), D(v[4]), D(v[0]), D(v[1]), D(v[2])));
          }
          foreach (var k in L(frame["k"]))
          {
            var v = L(k);
            source.KillList.Add(new KillInfo((int)D(v[0]), D(v[1]), D(v[2]), D(v[3]), D(v[4]), D(v[5]), D(v[6]), D(v[7]), 0, (EnemyKind)(int)D(v[8])));
          }
          foreach (var e in L(eventList)) events.Add(EventOf(L(e)));
        }
        trace.Clear();
        trace.BeginFrame(f, 0, 0, dt > 0, source.HitList, source.KillList.Count);
        tamper?.Invoke(director, f);
        director.Play(events, source);
        director.MusouState(D(p[4]) != 0, true);
        trace.EndFrame();
        fragments.Update(dt);
        sparks.Update(dt);
        dust.Update(dt);
        waves.Update(dt);

        // Output calls, in order.
        trace.CopyCues(cues);
        var expected = frame.TryGetValue("c", out var c) ? L(c) : new List<object>();
        if (expected.Count != cues.Count)
          result.Fail($"{at} calls: expected {expected.Count}, got {cues.Count} ({string.Join(" ", cues.ConvertAll(x => x.Name))})");
        for (int i = 0; i < Math.Min(expected.Count, cues.Count); i++)
        {
          var call = L(expected[i]);
          string name = (string)call[0];
          var cue = cues[i];
          result.Text($"{at} call {i}", name, cue.Name);
          if (name != cue.Name) break;
          replay.Calls[name] = replay.Calls.TryGetValue(name, out int n) ? n + 1 : 1;
          if (call.Count - 1 != cue.ArgCount) result.Fail($"{at} {name} args: expected {call.Count - 1}, got {cue.ArgCount}");
          for (int a = 0; a < Math.Min(call.Count - 1, cue.ArgCount); a++) result.Number($"{at} {name}[{a}]", Arg(name, a, call[a + 1]), cue.Arg(a), CallTolerance);
        }

        // Random draws: the shared generator must sit where the Web's does.
        int draws = (int)D(frame["r"]);
        replay.Draws += draws;
        for (int i = 0; i < draws; i++) expectedRng.Next();
        if (expectedRng.State != director.Rng.State) result.Fail($"{at} random draws differ (expected {draws} this frame)");

        CompareDigest(result, at, frame, sparks, dust, fragments, waves);
        if (frame.TryGetValue("full", out var full)) CompareFull(result, at, O(full), sparks, dust, fragments);
        result.Frames++;
      }
      return replay;
    }

    static double Sum(float[] a, int n)
    {
      double s = 0;
      for (int i = 0; i < n; i++) s += a[i];
      return s;
    }

    static void CompareDigest(CombatParity.Result result, string at, Dictionary<string, object> frame, SparkField sparks, DustField dust,
      FragmentField fragments, ShockwaveSet waves)
    {
      var n = L(frame["n"]);
      int[] counts = { sparks.Count, dust.Count, fragments.Count, waves.ActiveCount };
      string[] names = { "sparks", "dust", "fragments", "activeWaves" };
      for (int i = 0; i < counts.Length; i++) result.Number($"{at} {names[i]} count", D(n[i]), counts[i], 0);
      var sums = L(frame["sum"]);
      (double Value, int Count)[] actual =
      {
        (Sum(sparks.Pos, sparks.Count * 3), sparks.Count * 3), (Sum(sparks.Color, sparks.Count * 4), sparks.Count * 4),
        (Sum(dust.Pos, dust.Count * 3), dust.Count * 3), (Sum(dust.Size, dust.Count), dust.Count),
        (Sum(fragments.P, fragments.Count * 3), fragments.Count * 3), (Sum(fragments.R, fragments.Count * 3), fragments.Count * 3),
      };
      string[] sumNames = { "sparkPos", "sparkColor", "dustPos", "dustSize", "fragmentPos", "fragmentRot" };
      for (int i = 0; i < actual.Length; i++)
        result.Number($"{at} sum {sumNames[i]}", D(sums[i]), actual[i].Value, 1e-5 + SumToleranceEach * actual[i].Count);
      var expectedWaves = L(frame["waves"]);
      for (int i = 0; i < expectedWaves.Count; i++)
      {
        var e = i < ShockwaveSet.RingCount ? waves.Rings[i] : waves.Pillars[i - ShockwaveSet.RingCount];
        if (expectedWaves[i] is List<object> w)
        {
          if (!e.Active) { result.Fail($"{at} wave {i}: expected active"); continue; }
          result.Number($"{at} wave {i} t", D(w[0]), e.T, 1e-5);
          result.Number($"{at} wave {i} scaleX", D(w[1]), e.ScaleX, 1e-5);
          result.Number($"{at} wave {i} scaleY", D(w[2]), e.ScaleY, 1e-5);
        }
        else if (e.Active) result.Fail($"{at} wave {i}: expected inactive");
      }
    }

    static void Values(CombatParity.Result result, string at, object expected, float[] actual)
    {
      var list = L(expected);
      for (int i = 0; i < list.Count; i++) result.Number($"{at}[{i}]", D(list[i]), actual[i], StateTolerance);
    }

    static void CompareFull(CombatParity.Result result, string at, Dictionary<string, object> full, SparkField sparks, DustField dust, FragmentField fragments)
    {
      var s = O(full["sparks"]);
      Values(result, at + " spark pos", s["pos"], sparks.Pos);
      Values(result, at + " spark vel", s["vel"], sparks.Vel);
      Values(result, at + " spark color", s["color"], sparks.Color);
      Values(result, at + " spark size", s["size"], sparks.Size);
      Values(result, at + " spark life", s["life"], sparks.Life);
      var d = O(full["dust"]);
      Values(result, at + " dust pos", d["pos"], dust.Pos);
      Values(result, at + " dust size", d["size"], dust.Size);
      Values(result, at + " dust alpha", d["alpha"], dust.Alpha);
      var r = O(full["fragments"]);
      Values(result, at + " fragment p", r["p"], fragments.P);
      Values(result, at + " fragment r", r["r"], fragments.R);
      Values(result, at + " fragment size", r["size"], fragments.Size);
      Values(result, at + " fragment life", r["life"], fragments.Life);
      Values(result, at + " fragment color", r["color"], fragments.Colors);
    }

    public static CombatParity.Result RunTrail(Dictionary<string, object> trail)
    {
      var result = new CombatParity.Result();
      var ribbon = new TrailRibbon();
      string id = "trail@" + F(D(trail["hz"]));
      foreach (var frameObject in L(trail["frames"]))
      {
        var f = O(frameObject);
        string at = $"{id} f{F(D(f["f"]))}";
        double time = D(f["time"]);
        var b = L(f["base"]);
        var t = L(f["tip"]);
        ribbon.SetStyle(D(f["musou"]) != 0);
        if (D(f["active"]) != 0) ribbon.Push(D(b[0]), D(b[1]), D(b[2]), D(t[0]), D(t[1]), D(t[2]), time);
        ribbon.Update(time);
        result.Number(at + " n", D(f["n"]), ribbon.Count, 0);
        Values(result, at + " positions", f["positions"], ribbon.Positions);
        Values(result, at + " fade", f["fade"], ribbon.Fade);
        result.Frames++;
      }
      return result;
    }

    public static CombatParity.Result ComparePalette(Dictionary<string, object> fixture)
    {
      var result = new CombatParity.Result();
      var palette = O(fixture["palette"]);
      var ported = new Dictionary<string, Rgb>
      {
        ["armor"] = FragmentField.Armor, ["armorLight"] = FragmentField.ArmorLight, ["armorDark"] = FragmentField.ArmorDark,
        ["cloth"] = FragmentField.Cloth, ["boot"] = FragmentField.Boot, ["skin"] = FragmentField.Skin, ["helmet"] = FragmentField.Helmet,
        ["trim"] = FragmentField.Trim, ["belt"] = FragmentField.Belt, ["steel"] = FragmentField.Steel, ["wood"] = FragmentField.Wood,
      };
      foreach (var entry in ported)
      {
        if (!palette.TryGetValue(entry.Key, out var c)) { result.Fail("palette missing " + entry.Key); continue; }
        var v = L(c);
        result.Number(entry.Key + ".r", D(v[0]), entry.Value.R, 1e-12);
        result.Number(entry.Key + ".g", D(v[1]), entry.Value.G, 1e-12);
        result.Number(entry.Key + ".b", D(v[2]), entry.Value.B, 1e-12);
      }
      return result;
    }
  }
}
