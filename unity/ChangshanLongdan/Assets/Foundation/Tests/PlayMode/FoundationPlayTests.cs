using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Changshan.Foundation.Tests
{
  public sealed class FoundationPlayTests
  {
    [UnityTest] public IEnumerator FoundationSceneBootsAcrossFrames()
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      int firstFrame = Time.frameCount;
      yield return null;
      yield return null;
      Assert.That(Time.frameCount, Is.GreaterThan(firstFrame));
      Assert.That(Camera.main, Is.Not.Null);
      Assert.That(Object.FindFirstObjectByType<FoundationSmoke>(), Is.Not.Null);
      Assert.That(GraphicsSettings.currentRenderPipeline, Is.InstanceOf<UniversalRenderPipelineAsset>());
      Assert.That(QualitySettings.activeColorSpace, Is.EqualTo(ColorSpace.Linear));
      Assert.That(Application.targetFrameRate, Is.EqualTo(60));
      Assert.That(QualitySettings.vSyncCount, Is.EqualTo(1));
      LogAssert.NoUnexpectedReceived();
    }
  }
}
