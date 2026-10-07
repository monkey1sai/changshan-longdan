using Changshan.View;
using UnityEngine;

namespace Changshan.Character
{
  // Port of the shake part of src/view/camera-rig.ts: trauma (0..1) added by hits and hurts, displacement proportional
  // to trauma squared, a heavy-hit "kick" that pulls the field of view in, both decaying in real time. Standalone it
  // applies its offsets in LateUpdate on top of whatever moved the camera this frame; with a CameraRig attached (E09)
  // it only forwards into the rig, which owns the shake and the camera pose.
  [DisallowMultipleComponent]
  public sealed class CameraShake : MonoBehaviour
  {
    public CameraRig Rig { get; set; }
    public float Trauma => Rig != null ? (float)Rig.Trauma : trauma;
    public float Punch => Rig != null ? (float)Rig.Punch : punch;
    float trauma, punch;

    Camera view;
    float baseFov = -1;
    Vector3 appliedOffset;
    Quaternion appliedRoll = Quaternion.identity;
    float time;

    public void AddTrauma(double amount)
    {
      if (Rig != null) Rig.AddTrauma(amount);
      else trauma = Mathf.Min(1, trauma + (float)amount);
    }

    public void Kick(double amount)
    {
      if (Rig != null) Rig.Kick(amount);
      else punch = Mathf.Max(punch, (float)amount);
    }

    void Awake() => view = GetComponent<Camera>();

    void LateUpdate()
    {
      if (Rig != null) return; // the rig view places the camera, shake included
      float dt = Time.unscaledDeltaTime;
      time += dt;
      // Undo last frame's shake first so offsets never accumulate.
      transform.rotation = transform.rotation * Quaternion.Inverse(appliedRoll);
      transform.position -= appliedOffset;
      float s = trauma * trauma;
      if (s > 1e-4f)
      {
        float t = time * 32;
        var local = new Vector3((Mathf.Sin(t * 1.3f) + Mathf.Sin(t * 2.7f + 1.1f) * 0.5f) * 0.28f * s,
          (Mathf.Sin(t * 1.7f + 2.3f) + Mathf.Sin(t * 3.1f) * 0.5f) * 0.22f * s, 0);
        appliedOffset = transform.rotation * local;
        appliedRoll = Quaternion.AngleAxis(Mathf.Sin(t * 2.1f + 0.7f) * 0.035f * s * Mathf.Rad2Deg, Vector3.forward);
      }
      else
      {
        appliedOffset = Vector3.zero;
        appliedRoll = Quaternion.identity;
      }
      transform.position += appliedOffset;
      transform.rotation = transform.rotation * appliedRoll;
      if (view != null)
      {
        if (baseFov < 0) baseFov = view.fieldOfView;
        view.fieldOfView = baseFov - punch * 4;
      }
      trauma = Mathf.Max(0, trauma - dt * 1.5f);
      punch = Mathf.Max(0, punch - dt * 6);
    }
  }
}
