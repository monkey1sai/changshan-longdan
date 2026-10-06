using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Changshan.Animation;
using Changshan.Combat;
using Changshan.Feedback;
using Changshan.Feedback.Audio;
using UnityEngine;
using UnityEngine.Rendering;

namespace Changshan.Character
{
  // E07 feedback in the scene: each frame's events go through the ported Presentation (FeedbackDirector) into the ported
  // particle simulations, the synthesized sounds, the camera shake and a HUD banner; this component only draws the
  // particles (meshes rebuilt after the camera has moved) and hands the mixer to the audio thread. Every output call is
  // recorded with the frame's hits and damage in Trace (the common trace). Logic coordinates are the Web world;
  // the mapping puts them on screen. Not drawn: post-processing values and the musou cut-in (kept in the trace only).
  [DefaultExecutionOrder(1000)] // after CameraShake, so billboards face the camera as it renders
  public sealed class FeedbackView : MonoBehaviour
  {
    public const string ShaderName = "ChangshanFeedback";
    const int QuadCapacity = FragmentField.DefaultCapacity * 6; // the largest user: fragment cubes, six faces each

    public SparkField Sparks { get; } = new SparkField();
    public DustField Dust { get; } = new DustField();
    public ShockwaveSet Waves { get; } = new ShockwaveSet();
    public FragmentField Fragments { get; } = new FragmentField(ArenaLayout.PlayLimit);
    public TrailRibbon Trail { get; } = new TrailRibbon();
    public PostValues Post { get; } = new PostValues();
    public FeedbackTrace Trace { get; } = new FeedbackTrace();
    public FeedbackDirector Director { get; private set; }
    public SfxBank Sound { get; private set; } // null when the platform has no audio output
    public Task Prewarm { get; private set; }
    public string BannerText { get; private set; } = "";
    public double BannerLeft { get; private set; }
    public int Cutins { get; private set; }
    public double SimClock { get; private set; } // game.ts simClock: the trail's time

    readonly List<FeedbackEvent> events = new List<FeedbackEvent>();
    readonly ViewCamera cameraSink = new ViewCamera();
    Matrix4x4 logicToDisplay = Matrix4x4.identity;
    LogicDisplayMapping mapping;
    long frame;
    bool built;
    GUIStyle bannerStyle;
    SimulationSource source;

    Layer sparkLayer, dustLayer, ringLayer, pillarLayer, trailLayer, fragmentLayer;
    static int[] quadIndices;
    readonly int[] stripIndices = new int[(TrailRibbon.Max - 1) * 6];
    readonly int[] pillarIndices = new int[ShockwaveSet.PillarCount * 32 * 6];

    public static FeedbackView Create(LogicDisplayMapping mapping)
    {
      var view = new GameObject("E07 Feedback").AddComponent<FeedbackView>();
      view.SetMapping(mapping);
      return view;
    }

    void Awake() => Build();

    void Build()
    {
      if (built) return;
      built = true;
      var hud = new Hud(this);
      ISfxSink audio = null;
      int rate = AudioSettings.outputSampleRate;
      if (rate >= 8000)
      {
        var mixer = new SfxMixer(rate);
        Sound = new SfxBank(new SfxSynth(rate), mixer, () => Time.realtimeSinceStartupAsDouble);
        audio = Sound;
        var bank = Sound;
        Prewarm = Task.Run(() => bank.Prewarm());
      }
      var sinks = TracingSinks.Wrap(new FeedbackSinks
      {
        Audio = audio, Sparks = Sparks, Dust = Dust, Waves = Waves, Fragments = Fragments, Camera = cameraSink, Post = Post, Hud = hud,
      }, Trace);
      Director = new FeedbackDirector(sinks);

      var shader = Resources.Load<Shader>(ShaderName);
      if (shader == null) Debug.LogError("FEEDBACK_SHADER_MISSING " + ShaderName);
      sparkLayer = new Layer(transform, "Sparks", shader, 0, BlendMode.SrcAlpha, BlendMode.One, false, 3005);
      dustLayer = new Layer(transform, "Dust", shader, 1, BlendMode.SrcAlpha, BlendMode.OneMinusSrcAlpha, false, 3001);
      ringLayer = new Layer(transform, "Rings", shader, 2, BlendMode.SrcAlpha, BlendMode.One, false, 3004);
      pillarLayer = new Layer(transform, "Pillars", shader, 3, BlendMode.SrcAlpha, BlendMode.One, false, 3004);
      trailLayer = new Layer(transform, "Trail", shader, 4, BlendMode.SrcAlpha, BlendMode.One, false, 3006);
      fragmentLayer = new Layer(transform, "Fragments", shader, 5, BlendMode.One, BlendMode.Zero, true, 2000);
      if (quadIndices == null)
      {
        quadIndices = new int[QuadCapacity * 6];
        for (int q = 0; q < QuadCapacity; q++)
        {
          int v = q * 4, i = q * 6;
          quadIndices[i] = v; quadIndices[i + 1] = v + 1; quadIndices[i + 2] = v + 2;
          quadIndices[i + 3] = v; quadIndices[i + 4] = v + 2; quadIndices[i + 5] = v + 3;
        }
      }
      for (int j = 0; j < TrailRibbon.Max - 1; j++)
      {
        int a = j * 2, i = j * 6;
        stripIndices[i] = a; stripIndices[i + 1] = a + 1; stripIndices[i + 2] = a + 3;
        stripIndices[i + 3] = a; stripIndices[i + 4] = a + 3; stripIndices[i + 5] = a + 2;
      }
      for (int p = 0, i = 0; p < ShockwaveSet.PillarCount; p++)
        for (int s = 0; s < 32; s++, i += 6)
        {
          int a = p * 66 + s * 2;
          pillarIndices[i] = a; pillarIndices[i + 1] = a + 1; pillarIndices[i + 2] = a + 3;
          pillarIndices[i + 3] = a; pillarIndices[i + 4] = a + 3; pillarIndices[i + 5] = a + 2;
        }
    }

    public void SetMapping(LogicDisplayMapping m)
    {
      Build();
      mapping = m;
      logicToDisplay = Matrix4x4.TRS(m.ToDisplayPosition(0, 0, 0), Quaternion.Euler(0, (float)m.BaseYawDegrees, 0), Vector3.one) *
        Matrix4x4.Scale(new Vector3(-1, 1, 1));
      cameraSink.Mapping = m;
    }

    public void SetCamera(Camera view, CameraShake shake)
    {
      Build();
      if (cameraSink.View == view && cameraSink.Shake == shake) return;
      cameraSink.View = view;
      cameraSink.Shake = shake;
      if (Sound == null || view == null) return;
      // The audio thread mixes in through the listener (the scene has none unless the camera brings one).
      var listeners = FindObjectsByType<AudioListener>();
      var listener = listeners.Length > 0 ? listeners[0] : view.gameObject.AddComponent<AudioListener>();
      var output = listener.GetComponent<FeedbackAudioOutput>();
      if (output == null) output = listener.gameObject.AddComponent<FeedbackAudioOutput>();
      output.Mixer = Sound.Mixer;
    }

    // One rendered frame after the simulation stepped (or held for hit-stop): play its events.
    public void PlayStep(CombatSimulation sim)
    {
      Build();
      cameraSink.Refresh();
      Trace.BeginFrame(frame++, sim.Clock.SimSteps, sim.Clock.SimTime, sim.SteppedThisFrame, sim.Hits, sim.Kills.Count);
      FeedbackEvents.FromStep(sim, events);
      Director.Play(events, Source(sim));
      Director.MusouState(sim.Player.State == PlayerState.Musou, true);
      Trace.EndFrame();
    }

    // The events of an injected strike (outside a step), traced as their own frame.
    public void PlayStrike(CombatSimulation sim)
    {
      Build();
      cameraSink.Refresh();
      Trace.BeginFrame(frame++, sim.Clock.SimSteps, sim.Clock.SimTime, false, Array.Empty<HitEvent>(), 0);
      FeedbackEvents.FromStrike(sim, events);
      Director.Play(events, Source(sim));
      Trace.EndFrame();
    }

    SimulationSource Source(CombatSimulation sim)
    {
      if (source == null || !source.Reads(sim)) source = new SimulationSource(sim);
      return source;
    }

    // game.ts updateVisuals after the model posed: the effects advance with the game-time step (frozen in hit-stop),
    // the trail records the spear while a move's trail window is open, post values and the banner decay in real time.
    public void AfterAnimate(CombatSimulation sim, ProceduralRig rig, double realDt)
    {
      Build();
      double simDt = sim.Clock.LastSimDt;
      SimClock += simDt;
      Post.Decay(realDt);
      Fragments.Update(simDt);
      Sparks.Update(simDt);
      Dust.Update(simDt);
      Waves.Update(simDt);
      var p = sim.Player;
      bool active = false;
      if (p.Move != null && (p.State == PlayerState.Attack || p.State == PlayerState.Musou))
      {
        var windows = p.Move.Trail;
        for (int i = 0; i < windows.Count; i++)
          if (p.MoveTime >= windows[i].Start && p.MoveTime <= windows[i].End) active = true;
      }
      Trail.SetStyle(p.State == PlayerState.Musou);
      if (active && rig != null) Trail.Push(rig.TipBase.X, rig.TipBase.Y, rig.TipBase.Z, rig.Tip.X, rig.Tip.Y, rig.Tip.Z, SimClock);
      Trail.Update(SimClock);
      if (BannerLeft > 0) BannerLeft = Math.Max(0, BannerLeft - realDt);
    }

    // A new fight (game.ts resetPresentation): particles, trail, rings and the presentation state are cleared; sounds
    // already playing finish like the Web's.
    public void Clear()
    {
      Build();
      Fragments.Clear();
      Sparks.Clear();
      Dust.Clear();
      Trail.Clear();
      Waves.Clear();
      Post.Clear();
      Director.Reset();
      BannerText = "";
      BannerLeft = 0;
    }

    void LateUpdate()
    {
      var view = cameraSink.View != null ? cameraSink.View : Camera.main;
      if (view == null) return;
      var toCamera = view.worldToCameraMatrix * logicToDisplay;
      var toWorld = view.cameraToWorldMatrix;
      DrawSparks(toCamera, toWorld);
      DrawDust(toCamera, toWorld);
      DrawWaves();
      DrawTrail();
      DrawFragments();
    }

    void DrawSparks(Matrix4x4 toCamera, Matrix4x4 toWorld)
    {
      var l = sparkLayer;
      var s = Sparks;
      for (int i = 0; i < s.Count; i++)
      {
        int i3 = i * 3;
        var head = toCamera.MultiplyPoint3x4(new Vector3(s.Pos[i3], s.Pos[i3 + 1], s.Pos[i3 + 2]));
        var tail = toCamera.MultiplyPoint3x4(new Vector3(s.Pos[i3] - s.Vel[i3] * 0.035f, s.Pos[i3 + 1] - s.Vel[i3 + 1] * 0.035f,
          s.Pos[i3 + 2] - s.Vel[i3 + 2] * 0.035f));
        var dir = new Vector2(head.x - tail.x, head.y - tail.y);
        float len = dir.magnitude;
        dir = len > 1e-5f ? dir / len : new Vector2(1, 0);
        var perp = new Vector2(-dir.y, dir.x);
        float size = s.Size[i];
        var color = new Color(s.Color[i * 4], s.Color[i * 4 + 1], s.Color[i * 4 + 2], s.Color[i * 4 + 3]);
        for (int c = 0; c < 4; c++)
        {
          float px = c == 0 || c == 3 ? -0.5f : 0.5f, py = c < 2 ? -0.5f : 0.5f;
          var center = Vector3.Lerp(tail, head, px + 0.5f);
          center.x += dir.x * px * size + perp.x * py * size;
          center.y += dir.y * px * size + perp.y * py * size;
          l.Put(i * 4 + c, toWorld.MultiplyPoint3x4(center), Vector3.up, color, new Vector2(px, py));
        }
      }
      l.Commit(s.Count * 4, quadIndices, s.Count * 6);
    }

    void DrawDust(Matrix4x4 toCamera, Matrix4x4 toWorld)
    {
      var l = dustLayer;
      var d = Dust;
      for (int i = 0; i < d.Count; i++)
      {
        int i3 = i * 3;
        var center = toCamera.MultiplyPoint3x4(new Vector3(d.Pos[i3], d.Pos[i3 + 1], d.Pos[i3 + 2]));
        float size = d.Size[i];
        var color = new Color(0.36f, 0.28f, 0.21f, d.Alpha[i]);
        for (int c = 0; c < 4; c++)
        {
          float px = c == 0 || c == 3 ? -0.5f : 0.5f, py = c < 2 ? -0.5f : 0.5f;
          l.Put(i * 4 + c, toWorld.MultiplyPoint3x4(center + new Vector3(px * size, py * size, 0)), Vector3.up, color, new Vector2(px + 0.5f, py + 0.5f));
        }
      }
      l.Commit(d.Count * 4, quadIndices, d.Count * 6);
    }

    void DrawWaves()
    {
      int n = 0;
      foreach (var e in Waves.Rings)
      {
        if (!e.Active) continue;
        var color = new Color((float)e.Color.R, (float)e.Color.G, (float)e.Color.B, (float)e.Alpha);
        for (int c = 0; c < 4; c++)
        {
          float u = c == 0 || c == 3 ? 0 : 1, v = c < 2 ? 0 : 1;
          var logic = new Vector3((float)(e.X + (2 * u - 1) * e.ScaleX), (float)e.Y, (float)(e.Z - (2 * v - 1) * e.ScaleZ));
          ringLayer.Put(n * 4 + c, logicToDisplay.MultiplyPoint3x4(logic), Vector3.up, color, new Vector2(u, v));
        }
        n++;
      }
      ringLayer.Commit(n * 4, quadIndices, n * 6);

      int pillars = 0;
      for (int p = 0; p < ShockwaveSet.PillarCount; p++)
      {
        var e = Waves.Pillars[p];
        if (!e.Active) continue;
        var color = new Color((float)e.Color.R, (float)e.Color.G, (float)e.Color.B, (float)e.Alpha);
        for (int s = 0; s <= 32; s++)
        {
          float u = s / 32f;
          double theta = u * Math.PI * 2;
          double x = e.X + Math.Sin(theta) * e.ScaleX, z = e.Z + Math.Cos(theta) * e.ScaleZ;
          int v = pillars * 66 + s * 2;
          pillarLayer.Put(v, logicToDisplay.MultiplyPoint3x4(new Vector3((float)x, (float)e.Y, (float)z)), Vector3.up, color, new Vector2(u, 0));
          pillarLayer.Put(v + 1, logicToDisplay.MultiplyPoint3x4(new Vector3((float)x, (float)(e.Y + e.ScaleY), (float)z)), Vector3.up, color, new Vector2(u, 1));
        }
        pillars++;
      }
      pillarLayer.Commit(pillars * 66, pillarIndices, pillars * 32 * 6);
    }

    void DrawTrail()
    {
      var t = Trail;
      var rgb = t.Color;
      for (int j = 0; j < t.Count; j++)
      {
        for (int side = 0; side < 2; side++)
        {
          int o = j * 6 + side * 3;
          var logic = new Vector3(t.Positions[o], t.Positions[o + 1], t.Positions[o + 2]);
          var color = new Color((float)rgb.R, (float)rgb.G, (float)rgb.B, t.Fade[j * 2 + side]);
          trailLayer.Put(j * 2 + side, logicToDisplay.MultiplyPoint3x4(logic), Vector3.up, color, new Vector2(j, side));
        }
      }
      trailLayer.Commit(t.Count * 2, stripIndices, Math.Max(0, t.Count - 1) * 6);
    }

    static readonly Vector3[] FaceNormals = { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };

    void DrawFragments()
    {
      var f = Fragments;
      var linear = logicToDisplay; // rotation + mirror: also maps normals
      for (int i = 0; i < f.Count; i++)
      {
        int i3 = i * 3;
        var m = EulerXyz(f.R[i3], f.R[i3 + 1], f.R[i3 + 2]);
        float size = (float)f.DisplaySize(i);
        var center = new Vector3(f.P[i3], f.P[i3 + 1], f.P[i3 + 2]);
        var color = new Color(f.Colors[i3], f.Colors[i3 + 1], f.Colors[i3 + 2], 1);
        for (int face = 0; face < 6; face++)
        {
          var n = FaceNormals[face];
          // Two in-plane axes of the face.
          var a = Mathf.Abs(n.y) > 0.5f ? Vector3.right : Vector3.up;
          var b = Vector3.Cross(n, a);
          var normal = linear.MultiplyVector(m.MultiplyVector(n));
          for (int c = 0; c < 4; c++)
          {
            float pa = c == 0 || c == 3 ? -0.5f : 0.5f, pb = c < 2 ? -0.5f : 0.5f;
            var local = (n * 0.5f + a * pa + b * pb) * size;
            var logic = center + m.MultiplyVector(local);
            fragmentLayer.Put((i * 6 + face) * 4 + c, linear.MultiplyPoint3x4(logic), normal, color, Vector2.zero);
          }
        }
      }
      fragmentLayer.Commit(f.Count * 24, quadIndices, f.Count * 36);
    }

    // three.js Matrix4.makeRotationFromEuler, order 'XYZ'.
    static Matrix4x4 EulerXyz(double x, double y, double z)
    {
      double a = Math.Cos(x), b = Math.Sin(x), c = Math.Cos(y), d = Math.Sin(y), e = Math.Cos(z), f = Math.Sin(z);
      double ae = a * e, af = a * f, be = b * e, bf = b * f;
      var m = Matrix4x4.identity;
      m.m00 = (float)(c * e); m.m01 = (float)(-c * f); m.m02 = (float)d;
      m.m10 = (float)(af + be * d); m.m11 = (float)(ae - bf * d); m.m12 = (float)(-b * c);
      m.m20 = (float)(bf - ae * d); m.m21 = (float)(be + af * d); m.m22 = (float)(a * c);
      return m;
    }

    void OnGUI()
    {
      if (BannerLeft <= 0 || BannerText.Length == 0) return;
      if (bannerStyle == null) bannerStyle = new GUIStyle(GUI.skin.label) { fontSize = 40, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
      bannerStyle.normal.textColor = new Color(1f, 0.82f, 0.35f, Mathf.Clamp01((float)BannerLeft * 2));
      GUI.Label(new UnityEngine.Rect(0, Screen.height * 0.18f, Screen.width, 80), BannerText, bannerStyle);
    }

    void OnDestroy()
    {
      foreach (var l in new[] { sparkLayer, dustLayer, ringLayer, pillarLayer, trailLayer, fragmentLayer }) l?.Destroy();
    }

    // One drawn mesh with preallocated vertex arrays (world-space vertices, identity transform).
    sealed class Layer
    {
      readonly Mesh mesh;
      readonly Material material;
      Vector3[] positions = new Vector3[64], normals = new Vector3[64];
      Color[] colors = new Color[64];
      Vector2[] uvs = new Vector2[64];

      public Layer(Transform parent, string name, Shader shader, int mode, BlendMode src, BlendMode dst, bool depthWrite, int queue)
      {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        mesh = new Mesh { name = "E07 " + name, indexFormat = IndexFormat.UInt32 };
        mesh.MarkDynamic();
        go.AddComponent<MeshFilter>().sharedMesh = mesh;
        var renderer = go.AddComponent<MeshRenderer>();
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
        if (shader == null) return;
        material = new Material(shader) { name = "E07 " + name, renderQueue = queue };
        material.SetFloat("_Mode", mode);
        material.SetFloat("_SrcBlend", (float)src);
        material.SetFloat("_DstBlend", (float)dst);
        material.SetFloat("_ZWrite", depthWrite ? 1 : 0);
        renderer.sharedMaterial = material;
      }

      public void Put(int i, Vector3 position, Vector3 normal, Color color, Vector2 uv)
      {
        if (i >= positions.Length)
        {
          int size = Math.Max(i + 1, positions.Length * 2);
          Array.Resize(ref positions, size);
          Array.Resize(ref normals, size);
          Array.Resize(ref colors, size);
          Array.Resize(ref uvs, size);
        }
        positions[i] = position;
        normals[i] = normal;
        colors[i] = color;
        uvs[i] = uv;
      }

      public void Commit(int vertices, int[] indices, int indexCount)
      {
        mesh.Clear(true);
        if (vertices == 0) return;
        mesh.SetVertices(positions, 0, vertices);
        mesh.SetNormals(normals, 0, vertices);
        mesh.SetColors(colors, 0, vertices);
        mesh.SetUVs(0, uvs, 0, vertices);
        mesh.SetIndices(indices, 0, indexCount, MeshTopology.Triangles, 0, false);
        mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 2000);
      }

      public void Destroy()
      {
        if (mesh != null) UnityEngine.Object.Destroy(mesh);
        if (material != null) UnityEngine.Object.Destroy(material);
      }
    }

    // The camera for the presentation: the shake, and the listener position and right vector in logic coordinates.
    sealed class ViewCamera : ICameraSink
    {
      public Camera View;
      public CameraShake Shake;
      public LogicDisplayMapping Mapping;
      public double PositionX { get; private set; }
      public double PositionZ { get; private set; }
      public double RightX { get; private set; } = 1;
      public double RightZ { get; private set; }

      public void Refresh()
      {
        if (View == null) return;
        var t = View.transform;
        var (x, z) = Mapping.ToLogicPosition(t.position);
        var (rx, rz) = Mapping.ToLogicPosition(t.position + t.right);
        PositionX = x;
        PositionZ = z;
        double dx = rx - x, dz = rz - z, len = Math.Sqrt(dx * dx + dz * dz);
        if (len < 1e-9) return;
        RightX = dx / len;
        RightZ = dz / len;
      }

      public void AddTrauma(double amount) => Shake?.AddTrauma(amount);
      public void Kick(double amount) => Shake?.Kick(amount);
    }

    sealed class Hud : IHudSink
    {
      readonly FeedbackView view;
      public Hud(FeedbackView view) => this.view = view;

      public void ShowBanner(Changshan.Feedback.Banner banner, double seconds, bool gold)
      {
        view.BannerText = banner == Changshan.Feedback.Banner.MusouReady ? "龍膽 就緒 / Longdan Ready" : banner.ToString();
        view.BannerLeft = seconds;
      }

      public void PlayCutin() => view.Cutins++;
    }
  }

  // Lives next to the AudioListener: the audio thread pulls the feedback mixer into the final mix.
  public sealed class FeedbackAudioOutput : MonoBehaviour
  {
    public volatile SfxMixer Mixer;

    void OnAudioFilterRead(float[] data, int channels)
    {
      var mixer = Mixer;
      if (mixer == null || channels < 1) return;
      mixer.Render(data, data.Length / channels, channels);
    }
  }
}
