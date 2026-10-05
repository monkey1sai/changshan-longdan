using System;
using UnityEngine;

namespace Changshan.Foundation
{
  // E02 boundary only. Gameplay and assets remain in the retained Web project.
  public static class FoundationContract
  {
    public const string EditorVersion = "6000.6.4f1";
    public const int Width = 1920;
    public const int Height = 1080;
    public const int FrameRate = 60;
    public const int VSync = 1;
    public const bool AnimatorRootMotion = false;
    public const string MovementAuthority = "gameplay-controller";

    public static Vector3 Forward(float radians)
    {
      if (float.IsNaN(radians) || float.IsInfinity(radians))
        throw new ArgumentOutOfRangeException(nameof(radians));
      return new Vector3(Mathf.Sin(radians), 0, Mathf.Cos(radians));
    }

    public static Vector3 InputRight(float radians)
    {
      if (float.IsNaN(radians) || float.IsInfinity(radians))
        throw new ArgumentOutOfRangeException(nameof(radians));
      return new Vector3(-Mathf.Cos(radians), 0, Mathf.Sin(radians));
    }
  }
}
