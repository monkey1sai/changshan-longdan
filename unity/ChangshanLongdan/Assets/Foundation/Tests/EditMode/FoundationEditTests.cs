using System;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Changshan.Foundation.Tests
{
  public sealed class FoundationEditTests
  {
    [Test] public void FixedEditorAndWindowsTargetAreEffective()
    {
      Assert.That(Application.unityVersion, Is.EqualTo(FoundationContract.EditorVersion));
      Assert.That(EditorUserBuildSettings.activeBuildTarget, Is.EqualTo(BuildTarget.StandaloneWindows64));
      Assert.That(PlayerSettings.GetScriptingBackend(NamedBuildTarget.Standalone), Is.EqualTo(ScriptingImplementation.Mono2x));
      Assert.That(PlayerSettings.GetGraphicsAPIs(BuildTarget.StandaloneWindows64), Is.EqualTo(new[] { GraphicsDeviceType.Direct3D11 }));
    }
    [Test] public void PipelineAndResolutionMatchDecision()
    {
      Assert.That(GraphicsSettings.defaultRenderPipeline, Is.InstanceOf<UniversalRenderPipelineAsset>());
      Assert.That(((UniversalRenderPipelineAsset)GraphicsSettings.defaultRenderPipeline).renderScale, Is.EqualTo(1));
      Assert.That(PlayerSettings.colorSpace, Is.EqualTo(ColorSpace.Linear));
      Assert.That(PlayerSettings.defaultScreenWidth, Is.EqualTo(1920));
      Assert.That(PlayerSettings.defaultScreenHeight, Is.EqualTo(1080));
      Assert.That(QualitySettings.vSyncCount, Is.EqualTo(1));
    }
    [TestCase(0f, 0f, 1f)] [TestCase(Mathf.PI / 2, 1f, 0f)] [TestCase(-Mathf.PI / 2, -1f, 0f)]
    public void RadianForwardRetainsSourceConvention(float angle, float x, float z)
    {
      var actual = FoundationContract.Forward(angle);
      Assert.That(actual.x, Is.EqualTo(x).Within(0.000001));
      Assert.That(actual.z, Is.EqualTo(z).Within(0.000001));
      Assert.That(actual.y, Is.Zero);
    }
    [Test] public void InputRightRetainsNegativeXAxisAtZero()
    {
      Assert.That(FoundationContract.InputRight(0), Is.EqualTo(Vector3.left));
      Assert.That(FoundationContract.AnimatorRootMotion, Is.False);
      Assert.That(FoundationContract.MovementAuthority, Is.EqualTo("gameplay-controller"));
    }
    [TestCase(float.NaN)] [TestCase(float.PositiveInfinity)] [TestCase(float.NegativeInfinity)]
    public void NonfiniteAnglesAreRejected(float angle)
    {
      Assert.Throws<ArgumentOutOfRangeException>(() => FoundationContract.Forward(angle));
      Assert.Throws<ArgumentOutOfRangeException>(() => FoundationContract.InputRight(angle));
    }
  }
}
