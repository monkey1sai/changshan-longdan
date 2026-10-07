using System;
using Changshan.Animation;
using Changshan.Combat;
using Changshan.View;
using UnityEngine;

namespace Changshan.Character
{
  // E09: the camera follows the ported rig. Every frame the rig computes the Web camera (position, rotation, up, fov,
  // shake included) in logic space and this component writes it to the Unity camera through the logic-to-display
  // mapping; it is the only thing that moves the camera, so the E07 CameraShake no longer stacks its own offsets. The
  // barracks roofs hide when the player walks under an eave (RoofCutaway).
  [DisallowMultipleComponent]
  public sealed class CameraRigView : MonoBehaviour
  {
    public const string ShakePref = "changshan.shake"; // PlayerPrefs: 1 on (default), 0 off

    public CameraRig Rig { get; private set; }
    public Camera View { get; private set; }
    public double Clock { get; private set; } // real time since the view started (game.ts clock)
    public bool[] RoofsVisible { get; } = new bool[CastleGeometry.Barracks.Count];
    public CastlePlaceholders Castle { get; set; } // optional: its roofs follow RoofsVisible

    LogicDisplayMapping mapping;
    bool hasMapping;

    public static CameraRigView Attach(Camera view, LogicDisplayMapping mapping)
    {
      if (view == null) throw new ArgumentNullException(nameof(view));
      var rigView = view.GetComponent<CameraRigView>();
      if (rigView == null) rigView = view.gameObject.AddComponent<CameraRigView>();
      rigView.Bind(view, mapping);
      return rigView;
    }

    void Bind(Camera view, LogicDisplayMapping m)
    {
      View = view;
      mapping = m;
      hasMapping = true;
      if (Rig == null)
      {
        Rig = new CameraRig(view.pixelHeight > 0 ? (double)view.pixelWidth / view.pixelHeight : 16.0 / 9) { ShakeEnabled = ShakeEnabledPref };
        for (int i = 0; i < RoofsVisible.Length; i++) RoofsVisible[i] = true;
      }
      view.nearClipPlane = (float)CameraRig.Near;
      view.farClipPlane = (float)CameraRig.Far;
      view.fieldOfView = (float)Rig.Fov;
      // The E07 shake becomes a forwarder into the rig.
      var shake = view.GetComponent<CameraShake>();
      if (shake == null) shake = view.gameObject.AddComponent<CameraShake>();
      shake.Rig = Rig;
    }

    public static bool ShakeEnabledPref
    {
      get => PlayerPrefs.GetInt(ShakePref, 1) != 0;
      set
      {
        PlayerPrefs.SetInt(ShakePref, value ? 1 : 0);
        PlayerPrefs.Save();
      }
    }

    // The switch for this run only (recordings): nothing is written to PlayerPrefs.
    public void SetShakeForSession(bool enabled)
    {
      if (Rig != null) Rig.ShakeEnabled = enabled;
    }

    public bool ShakeEnabled
    {
      get => Rig != null && Rig.ShakeEnabled;
      set
      {
        if (Rig != null) Rig.ShakeEnabled = value;
        ShakeEnabledPref = value;
      }
    }

    // game.ts startBattle: the camera snaps behind the character.
    public void Snap(Player player)
    {
      Rig.Snap(new Vec3(player.X, player.Y, player.Z), player.Facing); // game.ts snaps to the start facing, which the player has then
      Apply();
    }

    // game.ts updateVisuals: one real-time frame of the rig, then the roofs.
    public void Follow(Player player, double realDt, double turn, double zoom, bool musou, bool title)
    {
      Clock += realDt;
      Rig.Update(realDt, new Vec3(player.X, player.Y, player.Z), turn, zoom, musou, title, Clock);
      RoofCutaway.Update(RoofsVisible, player.X, player.Z, title);
      Apply();
    }

    void Apply()
    {
      if (!hasMapping || View == null) return;
      var p = Rig.Position;
      // Logic (Web, right-handed) to display: mirror X then the scene yaw, as the character's skin binding does; a
      // Unity camera looks down its +Z while the Web camera looks down -Z, so turn it half around its own up axis.
      var rotation = Quaternion.Euler(0, (float)mapping.BaseYawDegrees, 0) * CharacterAnimation.Mirror(Rig.Rotation) * Quaternion.Euler(0, 180, 0);
      View.transform.SetPositionAndRotation(mapping.ToDisplayPosition(p.X, p.Y, p.Z), rotation);
      View.fieldOfView = (float)Rig.Fov;
      if (Castle != null) Castle.ShowRoofs(RoofsVisible);
    }

    // The logic yaw the controls follow (game.ts: the rig's forward).
    public double LogicYaw => Rig.Yaw;

    public Vector3 DisplayFocus => mapping.ToDisplayPosition(Rig.Focus.X, Rig.Focus.Y, Rig.Focus.Z);
  }
}
