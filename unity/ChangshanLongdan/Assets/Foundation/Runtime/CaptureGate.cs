using UnityEngine;

namespace Changshan.Foundation
{
  // Lets asynchronously loaded content hold the validation screenshot until it reaches a final state.
  public static class CaptureGate
  {
    static int pending;

    public static int Pending => pending;

    public static void Hold() { pending++; }

    public static void Release() { if (pending > 0) pending--; }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void ResetOnLoad() { pending = 0; }
  }
}
