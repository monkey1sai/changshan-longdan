using System;
using Changshan.Animation;
using Changshan.Combat;

namespace Changshan.View
{
  // Port of src/view/camera-rig.ts CameraRig: the third-person follow camera (turn, zoom, recenter, damped focus), the
  // musou high orbit, the title orbit around the castle, clearance against the castle and the eaves, lookAt with the
  // movement-forward "up", the trauma shake and the heavy-hit kick, and the field of view. Pure math in the Web's
  // right-handed world; the Unity view mirrors the result through LogicDisplayMapping. Shake can be switched off
  // (a Unity-only setting): trauma and kick are then ignored at the source so nothing moves.
  public sealed class CameraRig
  {
    public const double DefaultDistance = 9.2, MinDistance = 5.5, MaxDistance = 13, FocusHeight = 1.35;
    public const double Near = 0.1, Far = 1500, BaseFov = 55;
    static readonly Vec3 TitleLook = new Vec3(0, 4, -6);

    public double Yaw = Math.PI; // the camera's heading, defined like the character's facing
    public double Distance { get; private set; } = DefaultDistance;
    public Vec3 Focus;
    public Vec3 Forward = new Vec3(0, 0, -1); // horizontal forward (movement input follows it)
    public Vec3 Right = new Vec3(1, 0, 0);
    public bool ShakeEnabled = true;

    public double Trauma { get; private set; }
    public double Punch { get; private set; }
    public double Musou { get; private set; }
    public double Title { get; private set; } = 1;
    public double ZoomedDistance { get; private set; } = DefaultDistance;
    public double? RecenterYaw { get; private set; }

    // The camera as the Web's PerspectiveCamera ends up after update: world position, rotation, up and fov.
    public Vec3 Position { get; private set; }
    public Quat Rotation { get; private set; } = Quat.Identity;
    public Vec3 Up { get; private set; } = new Vec3(0, 1, 0);
    public double Fov { get; private set; } = BaseFov;
    public double Aspect { get; }

    Vec3 desired, look, orbit;

    public CameraRig(double aspect)
    {
      if (!(aspect > 0)) throw new ArgumentOutOfRangeException(nameof(aspect));
      Aspect = aspect;
    }

    // Shake strength accumulates (0..1); the displacement grows with its square.
    public void AddTrauma(double amount)
    {
      if (!ShakeEnabled) return;
      Trauma = Math.Min(1, Trauma + amount);
    }

    // A heavy hit pulls the field of view in for a moment.
    public void Kick(double amount)
    {
      if (!ShakeEnabled) return;
      Punch = Math.Max(Punch, amount);
    }

    public void Snap(Vec3 target, double yaw)
    {
      Yaw = yaw;
      RecenterYaw = null;
      Forward = new Vec3(Math.Sin(yaw), 0, Math.Cos(yaw));
      Right = new Vec3(-Math.Cos(yaw), 0, Math.Sin(yaw));
      Focus = new Vec3(target.X, target.Y + FocusHeight, target.Z);
    }

    public void Recenter(double facing) => RecenterYaw = facing;

    public double FocusDistance
    {
      get
      {
        double near = Position.DistanceTo(Focus);
        return CombatMath.Lerp(near, Position.DistanceTo(TitleLook), Title);
      }
    }

    public void Update(double dt, Vec3 target, double turn, double zoom, bool musou, bool titleMode, double time)
    {
      Yaw -= turn * 2.4 * dt;
      if (Math.Abs(turn) > 0.01) RecenterYaw = null;
      if (RecenterYaw.HasValue) Yaw = CombatMath.DampAngle(Yaw, RecenterYaw.Value, 10, dt);
      Distance = Clamp(Distance + zoom * 0.7, MinDistance, MaxDistance);
      ZoomedDistance = CombatMath.Damp(ZoomedDistance, Distance, 10, dt);
      Title = CombatMath.Damp(Title, titleMode ? 1 : 0, 2.2, dt);
      Musou = CombatMath.Damp(Musou, musou ? 1 : 0, 5, dt);
      Focus = new Vec3(CombatMath.Damp(Focus.X, target.X, 10, dt), CombatMath.Damp(Focus.Y, target.Y + FocusHeight, 6, dt), CombatMath.Damp(Focus.Z, target.Z, 10, dt));

      Forward = new Vec3(Math.Sin(Yaw), 0, Math.Cos(Yaw));
      Right = new Vec3(-Math.Cos(Yaw), 0, Math.Sin(Yaw));
      // Musou: higher, further and slowly orbiting so the circling dragon fits the frame.
      double yaw = Yaw + Musou * Math.Sin(time * 0.6) * 0.45;
      double dist = CombatMath.Lerp(ZoomedDistance, 11, Musou);
      double height = CombatMath.Lerp(4.4, 4.8, Musou);
      double edge = CastleGeometry.PlayLimit + 0.5;
      desired = new Vec3(
        Clamp(Focus.X - Math.Sin(yaw) * dist, -edge, edge),
        Math.Max(0.6, Focus.Y + height),
        Clamp(Focus.Z - Math.Cos(yaw) * dist, -edge, edge));
      look = new Vec3(Focus.X, Focus.Y + 0.15 + Musou * 1.2, Focus.Z);

      // A boom through the barracks, the keep or the arena edge shortens but keeps its height. The title orbit is
      // deliberately outside the castle and skips this.
      if (Title <= 0.001)
      {
        double clear = CameraClearance.Clearance(Focus.X, Focus.Z, desired.X, desired.Z);
        if (clear < 1)
        {
          desired.X = CombatMath.Lerp(Focus.X, desired.X, clear);
          desired.Z = CombatMath.Lerp(Focus.Z, desired.Z, clear);
        }
        CameraClearance.ClearOverhang(ref desired.X, ref desired.Z);
      }

      if (Title > 0.001)
      {
        double a = time * 0.045;
        orbit = new Vec3(Math.Sin(a) * 78, 38, Math.Cos(a) * 78);
        desired = Vec3.Lerp(desired, orbit, Title);
        look = Vec3.Lerp(look, TitleLook, Title);
      }
      Position = desired;
      Up = new Vec3(0, 1, 0);
      // Pulled straight above or pushed in front of the character by an eave: screen-up still follows movement-forward.
      if (Title <= 0.001) Up = new Vec3(Math.Sin(yaw), 0, Math.Cos(yaw));
      Rotation = LookAt(Position, look, Up);

      double s = Trauma * Trauma;
      if (s > 1e-4)
      {
        double t = time * 32;
        TranslateLocal(new Vec3(1, 0, 0), (Math.Sin(t * 1.3) + Math.Sin(t * 2.7 + 1.1) * 0.5) * 0.28 * s);
        TranslateLocal(new Vec3(0, 1, 0), (Math.Sin(t * 1.7 + 2.3) + Math.Sin(t * 3.1) * 0.5) * 0.22 * s);
        Rotation = Rotation * FromAxisAngle(new Vec3(0, 0, 1), Math.Sin(t * 2.1 + 0.7) * 0.035 * s);
      }
      Trauma = Math.Max(0, Trauma - dt * 1.5);
      Punch = Math.Max(0, Punch - dt * 6);

      // The Web rebuilds the projection only when the fov moves more than 0.01, so small changes are not applied.
      double fov = CombatMath.Lerp(55, 60, Musou) + Title * 5 - Punch * 4;
      if (Math.Abs(Fov - fov) > 0.01) Fov = fov;
    }

    // three.js Object3D.translateOnAxis: move along a local axis.
    void TranslateLocal(Vec3 axis, double distance) => Position = Position.AddScaled(axis.ApplyQuaternion(Rotation), distance);

    // three.js Quaternion.setFromAxisAngle (unit axis).
    public static Quat FromAxisAngle(Vec3 axis, double angle)
    {
      double h = angle / 2, s = Math.Sin(h);
      return new Quat(axis.X * s, axis.Y * s, axis.Z * s, Math.Cos(h));
    }

    // three.js Matrix4.lookAt for a camera (looks down its -Z): z = eye - target, x = up × z, y = z × x.
    public static Quat LookAt(Vec3 eye, Vec3 target, Vec3 up)
    {
      var z = eye - target;
      if (z.LengthSq() == 0) z = new Vec3(0, 0, 1); // eye and target at the same position
      z = z.Normalized();
      var x = Vec3.Cross(up, z);
      if (x.LengthSq() == 0)
      {
        // up and z are parallel
        if (Math.Abs(up.Z) == 1) z = new Vec3(z.X + 0.0001, z.Y, z.Z);
        else z = new Vec3(z.X, z.Y, z.Z + 0.0001);
        z = z.Normalized();
        x = Vec3.Cross(up, z);
      }
      x = x.Normalized();
      var y = Vec3.Cross(z, x);
      return Quat.FromRotationMatrix(Mat4.MakeBasis(x, y, z));
    }

    // three.js Vector3.project: world point to normalized device coordinates for this camera.
    public Vec3 Project(Vec3 world)
    {
      // view = inverse(camera world) * p: the camera world matrix is T(position) * R(rotation).
      var local = (world - Position).ApplyQuaternion(Rotation.Inverse());
      double f = 1 / Math.Tan(Fov * Math.PI / 360);
      double a = -(Far + Near) / (Far - Near), b = -2 * Far * Near / (Far - Near);
      double cx = f / Aspect * local.X, cy = f * local.Y, cz = a * local.Z + b, cw = -local.Z;
      return new Vec3(cx / cw, cy / cw, cz / cw);
    }

    static double Clamp(double v, double min, double max) => v < min ? min : v > max ? max : v;
  }
}
