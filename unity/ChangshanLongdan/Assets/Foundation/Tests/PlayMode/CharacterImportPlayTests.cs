using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Changshan.Character;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Changshan.Foundation.Tests
{
  public sealed class CharacterImportPlayTests
  {
    GameObject root;

    static string SourcePath => Path.Combine(Application.streamingAssetsPath, ZhaoYunContract.StreamingAssetPath);

    [TearDown] public void DestroyCharacter()
    {
      if (root) UnityEngine.Object.Destroy(root);
    }

    [UnityTest] public IEnumerator RealAssetReplacesFallbackOnlyAfterValidation()
    {
      var character = CreateCharacter();
      Assert.That(character.Fallback.activeInHierarchy, Is.True);
      var load = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      while (!load.IsCompleted)
      {
        Assert.That(character.Fallback.activeInHierarchy, Is.True, "fallback hidden while loading");
        Assert.That(character.Model, Is.Null, "model exposed before validation");
        Assert.That(root.GetComponentsInChildren<Renderer>(false).All(renderer => renderer.transform.IsChildOf(character.Fallback.transform)),
          Is.True, "an unvalidated import is rendering");
        yield return null;
      }
      AssertReady(character, load);
      var report = character.Report;
      Assert.That(character.Fallback.activeInHierarchy, Is.False);
      Assert.That(report.sourceSha256, Is.EqualTo(ZhaoYunContract.SourceSha256));
      Assert.That(report.sourceBytes, Is.EqualTo(ZhaoYunContract.SourceBytes));
      Assert.That(report.joints, Is.EqualTo(ZhaoYunContract.Joints));
      Assert.That(report.bodyMaterials, Is.EqualTo(ZhaoYunContract.BodyMaterials));
      Assert.That(report.weaponMaterials, Is.EqualTo(ZhaoYunContract.WeaponMaterials));
      Assert.That(report.bodyTriangles, Is.EqualTo(ZhaoYunContract.BodyTriangles));
      Assert.That(report.weaponTriangles, Is.EqualTo(ZhaoYunContract.WeaponTriangles));
      Assert.That(report.fallbackVisible, Is.False);
      Assert.That(report.modelVisible, Is.True);
      Assert.That(report.gltfErrors, Is.Zero, string.Join("\n", report.gltfMessages));
    }

    [UnityTest] public IEnumerator ImportNegatesGltfXAtKnownPoints()
    {
      var character = CreateCharacter();
      var load = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => load.IsCompleted);
      AssertReady(character, load);
      var gltf = GlbJson.Parse(File.ReadAllBytes(SourcePath));
      foreach (int index in gltf.skins[0].joints)
      {
        var node = gltf.nodes[index];
        var t = node.translation != null && node.translation.Length == 3 ? node.translation : new float[3];
        var joint = Find(character.Model.transform, node.name);
        Assert.That(joint.localPosition.x, Is.EqualTo(-t[0]).Within(1e-5f), node.name);
        Assert.That(joint.localPosition.y, Is.EqualTo(t[1]).Within(1e-5f), node.name);
        Assert.That(joint.localPosition.z, Is.EqualTo(t[2]).Within(1e-5f), node.name);
      }
      // glTF faces +Z with its left on +X; Unity faces +Z with its left on -X, so the left arm must land on -X.
      Assert.That(Find(character.Model.transform, "upperarm_l").position.x, Is.LessThan(-0.2f));
      Assert.That(Find(character.Model.transform, "upperarm_r").position.x, Is.GreaterThan(0.2f));
      // The body's glTF x-range is asymmetric (-0.80030 to 0.79595), so a missing or doubled flip is detectable.
      var bounds = Find(character.Model.transform, ZhaoYunContract.BodyNode).GetComponent<SkinnedMeshRenderer>().sharedMesh.bounds;
      Assert.That(bounds.min.x, Is.EqualTo(-0.7959493f).Within(1e-4f));
      Assert.That(bounds.max.x, Is.EqualTo(0.8003017f).Within(1e-4f));
    }

    [UnityTest] public IEnumerator SpearKeepsTipAndTipBaseOnItsLocalZ()
    {
      var character = CreateCharacter();
      var load = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => load.IsCompleted);
      AssertReady(character, load);
      var spear = Find(character.Model.transform, ZhaoYunContract.WeaponNode);
      var bounds = spear.GetComponent<MeshFilter>().sharedMesh.bounds;
      Assert.That(bounds.min.z, Is.EqualTo(ZhaoYunContract.WeaponMinZ).Within(1e-4f));
      Assert.That(bounds.max.z, Is.EqualTo(ZhaoYunContract.WeaponTipZ).Within(1e-4f));
      var report = character.Report;
      Assert.That(report.tipLocal, Is.EqualTo(new Vector3(0, 0, ZhaoYunContract.WeaponTipZ)));
      Assert.That(report.tipBaseLocal, Is.EqualTo(new Vector3(0, 0, ZhaoYunContract.WeaponTipBaseZ)));
      Assert.That(Vector3.Distance(report.tipWorld, spear.TransformPoint(report.tipLocal)), Is.LessThan(1e-5f));
      Assert.That(Vector3.Distance(report.tipBaseWorld, spear.TransformPoint(report.tipBaseLocal)), Is.LessThan(1e-5f));
      Assert.That(report.tipBaseLocal.z, Is.InRange(bounds.min.z, bounds.max.z));
    }

    [UnityTest] public IEnumerator RuntimeMaterialsMatchShippedShaderVariants()
    {
      var character = CreateCharacter();
      var load = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => load.IsCompleted);
      AssertReady(character, load);
      var shipped = Resources.LoadAll<Material>(ZhaoYunContract.ShaderVariantResources).ToDictionary(material => material.name);
      var runtime = character.Model.GetComponentsInChildren<Renderer>(true).SelectMany(renderer => renderer.sharedMaterials).Distinct().ToArray();
      Assert.That(runtime.Select(material => material.name).OrderBy(name => name, StringComparer.Ordinal),
        Is.EqualTo(shipped.Keys.OrderBy(name => name, StringComparer.Ordinal)));
      foreach (var material in runtime)
      {
        var variant = shipped[material.name];
        Assert.That(material.shader, Is.EqualTo(variant.shader), material.name);
        Assert.That(material.shaderKeywords.OrderBy(keyword => keyword, StringComparer.Ordinal),
          Is.EqualTo(variant.shaderKeywords.OrderBy(keyword => keyword, StringComparer.Ordinal)), material.name);
        Assert.That(material.renderQueue, Is.EqualTo(variant.renderQueue), material.name);
      }
    }

    [UnityTest] public IEnumerator MissingFileKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED FILE_MISSING"));
      var load = character.LoadFromStreamingAssets("Characters/missing.glb");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "FILE_MISSING");
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator TruncatedDataKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      var bytes = File.ReadAllBytes(SourcePath);
      Array.Resize(ref bytes, bytes.Length / 2);
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED DECODE_FAILED"));
      var load = character.LoadFromBytes(bytes, "truncated");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "DECODE_FAILED");
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator MissingRequiredBoneKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      var bytes = ReplaceInJson(File.ReadAllBytes(SourcePath), "\"hand_l\"", "\"hand_x\"");
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED REQUIRED_BONE_MISSING"));
      var load = character.LoadFromBytes(bytes, "hand_l renamed");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "REQUIRED_BONE_MISSING");
      Assert.That(character.Report.failureDetail, Does.Contain("hand_l"));
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator MissingMaterialKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      var bytes = ReplaceInJson(File.ReadAllBytes(SourcePath), "\"MAT_ZhaoYunShaft\"", "\"MAT_ZhaoYunShaf_\"");
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED MATERIAL_MISSING"));
      var load = character.LoadFromBytes(bytes, "spear material renamed");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "MATERIAL_MISSING");
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator UnreadableEmbeddedImageKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      var bytes = File.ReadAllBytes(SourcePath);
      // Zero the image header in place: the container stays valid, glTFast logs the unknown format and loads on.
      Array.Clear(bytes, EmbeddedImageOffset(bytes, 0), 16);
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED IMPORT_ERRORS"));
      var load = character.LoadFromBytes(bytes, "image 0 unreadable");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "IMPORT_ERRORS");
      Assert.That(character.Report.gltfErrors, Is.GreaterThan(0));
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator UndecodableJpegKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      var bytes = File.ReadAllBytes(SourcePath);
      // Keep FF D8 FF so format detection still says JPEG, then destroy the segments after it: glTFast logs nothing,
      // Texture2D.LoadImage fails, and only the full-size texture rule can reject the import.
      int image = EmbeddedImageOffset(bytes, 0);
      Assert.That(bytes.Skip(image).Take(3), Is.EqualTo(new byte[] { 0xFF, 0xD8, 0xFF }));
      Array.Clear(bytes, image + 3, 2048);
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED TEXTURE_MISSING"));
      var load = character.LoadFromBytes(bytes, "image 0 undecodable");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "TEXTURE_MISSING");
      Assert.That(character.Report.gltfErrors, Is.Zero, string.Join("\n", character.Report.gltfMessages));
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator SwappedJointOrderKeepsFallbackVisible()
    {
      var character = CreateCharacter();
      // Swap the names of two joints: all 21 remain, uniquely named, but the skin order no longer matches the contract.
      var bytes = File.ReadAllBytes(SourcePath);
      bytes = ReplaceInJson(bytes, "\"hand_l\"", "\"hand_x\"");
      bytes = ReplaceInJson(bytes, "\"hand_r\"", "\"hand_l\"");
      bytes = ReplaceInJson(bytes, "\"hand_x\"", "\"hand_r\"");
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED SKELETON_MISMATCH"));
      var load = character.LoadFromBytes(bytes, "hand joints swapped");
      yield return new WaitUntil(() => load.IsCompleted);
      AssertFallbackKept(character, load, "SKELETON_MISMATCH");
      yield return null;
      AssertNoImportLeft(character);
    }

    [UnityTest] public IEnumerator ValidatorRejectsAMissingFullSizeTexture()
    {
      var character = CreateCharacter();
      var load = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => load.IsCompleted);
      AssertReady(character, load);
      // A JPEG with an intact header but corrupt data loads without any glTFast error; only the size check catches it.
      var material = character.Model.GetComponentsInChildren<Renderer>(true).SelectMany(renderer => renderer.sharedMaterials)
        .First(candidate => candidate.name == ZhaoYunContract.BodyMaterials[0]);
      int property = material.GetTexturePropertyNameIDs().First(id => material.GetTexture(id) != null && material.GetTexture(id).width == ZhaoYunContract.TextureSize);
      material.SetTexture(property, Texture2D.whiteTexture);
      Assert.That(CharacterImportValidator.Validate(character.Model, new CharacterImportReport(), out var code, out var detail), Is.False);
      Assert.That(code, Is.EqualTo("TEXTURE_MISSING"), detail);
    }

    [UnityTest] public IEnumerator NewerLoadSupersedesAnUnfinishedOne()
    {
      var character = CreateCharacter();
      var first = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      var second = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => first.IsCompleted && second.IsCompleted);
      Assert.That(first.Result, Is.False, "superseded load reported success");
      AssertReady(character, second);
      yield return null;
      Assert.That(root.GetComponentsInChildren<SkinnedMeshRenderer>(true), Has.Length.EqualTo(1));
      Assert.That(root.transform.Cast<Transform>().Count(child => child.name == "ZhaoYun Model"), Is.EqualTo(1));
      Assert.That(character.Report.loadCount, Is.EqualTo(2));
    }

    [UnityTest] public IEnumerator FailedReloadKeepsTheValidModel()
    {
      var character = CreateCharacter();
      var first = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => first.IsCompleted);
      AssertReady(character, first);
      var valid = character.Model;
      LogAssert.Expect(LogType.Error, new Regex("^CHARACTER_LOAD_FAILED REQUIRED_BONE_MISSING"));
      var reload = character.LoadFromBytes(ReplaceInJson(File.ReadAllBytes(SourcePath), "\"hand_l\"", "\"hand_x\""), "hand_l renamed");
      yield return new WaitUntil(() => reload.IsCompleted);
      Assert.That(reload.Result, Is.False);
      Assert.That(character.Status, Is.EqualTo(CharacterLoadStatus.Failed));
      Assert.That(character.Model, Is.SameAs(valid));
      Assert.That(valid.activeInHierarchy, Is.True);
      Assert.That(character.Fallback.activeInHierarchy, Is.False);
      Assert.That(character.Report.modelVisible, Is.True);
      yield return null;
      Assert.That(root.GetComponentsInChildren<SkinnedMeshRenderer>(true), Has.Length.EqualTo(1));
    }

    [UnityTest] public IEnumerator ReloadReplacesTheModelExactlyOnce()
    {
      var character = CreateCharacter();
      var first = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      yield return new WaitUntil(() => first.IsCompleted);
      AssertReady(character, first);
      var previous = character.Model;
      var second = character.LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
      while (!second.IsCompleted)
      {
        Assert.That(previous != null && previous.activeInHierarchy, Is.True, "previous model hidden before its replacement was ready");
        Assert.That(character.Fallback.activeInHierarchy, Is.False);
        yield return null;
      }
      AssertReady(character, second);
      Assert.That(character.Model, Is.Not.SameAs(previous));
      yield return null;
      Assert.That(previous == null, Is.True, "replaced model was not destroyed");
      Assert.That(root.GetComponentsInChildren<SkinnedMeshRenderer>(true), Has.Length.EqualTo(1));
      Assert.That(character.Report.loadCount, Is.EqualTo(2));
    }

    [UnityTest] public IEnumerator FoundationSceneCharacterBecomesReady()
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      var character = UnityEngine.Object.FindAnyObjectByType<ZhaoYunCharacter>();
      Assert.That(character, Is.Not.Null);
      Assert.That(character.LoadOnStart, Is.True);
      yield return new WaitUntil(() => character.Status == CharacterLoadStatus.Ready || character.Status == CharacterLoadStatus.Failed);
      Assert.That(character.Status, Is.EqualTo(CharacterLoadStatus.Ready), character.Report.failureCode + " " + character.Report.failureDetail);
      Assert.That(character.Fallback.activeInHierarchy, Is.False);
      Assert.That(character.Model.activeInHierarchy, Is.True);
      Assert.That(CaptureGate.Pending, Is.Zero);
    }

    ZhaoYunCharacter CreateCharacter()
    {
      root = new GameObject("Character Under Test");
      root.SetActive(false); // configure before Awake
      var fallback = GameObject.CreatePrimitive(PrimitiveType.Cube);
      fallback.name = "Fallback";
      fallback.transform.SetParent(root.transform, false);
      var character = root.AddComponent<ZhaoYunCharacter>();
      character.LoadOnStart = false;
      character.Fallback = fallback;
      root.SetActive(true);
      return character;
    }

    static void AssertReady(ZhaoYunCharacter character, Task<bool> load)
    {
      Assert.That(load.Result, Is.True, character.Report.failureCode + " " + character.Report.failureDetail);
      Assert.That(character.Status, Is.EqualTo(CharacterLoadStatus.Ready));
      Assert.That(character.Model, Is.Not.Null);
      Assert.That(character.Model.activeInHierarchy, Is.True);
    }

    static void AssertFallbackKept(ZhaoYunCharacter character, Task<bool> load, string code)
    {
      Assert.That(load.Result, Is.False);
      Assert.That(character.Status, Is.EqualTo(CharacterLoadStatus.Failed));
      Assert.That(character.Report.failureCode, Is.EqualTo(code), character.Report.failureDetail);
      Assert.That(character.Model, Is.Null);
      Assert.That(character.Fallback.activeInHierarchy, Is.True);
      Assert.That(character.Report.fallbackVisible, Is.True);
      Assert.That(character.Report.modelVisible, Is.False);
    }

    void AssertNoImportLeft(ZhaoYunCharacter character)
    {
      Assert.That(root.GetComponentsInChildren<SkinnedMeshRenderer>(true), Is.Empty);
      Assert.That(root.transform.Cast<Transform>().Count(child => child.name == "ZhaoYun Model"), Is.Zero);
      Assert.That(character.Fallback.activeInHierarchy, Is.True);
    }

    static Transform Find(Transform parent, string name)
    {
      var found = parent.GetComponentsInChildren<Transform>(true).Where(candidate => candidate.name == name).ToArray();
      Assert.That(found, Has.Length.EqualTo(1), name);
      return found[0];
    }

    // Byte offset of an embedded image inside the GLB: BIN chunk data starts after the JSON chunk and its 8-byte header.
    static int EmbeddedImageOffset(byte[] glb, int image)
    {
      var layout = JsonUtility.FromJson<BinaryLayout>(GlbJson.Read(glb));
      int binary = 20 + (int)BitConverter.ToUInt32(glb, 12) + 8;
      return binary + layout.bufferViews[layout.images[image].bufferView].byteOffset;
    }

    [Serializable] class BinaryLayout { public LayoutImage[] images; public LayoutView[] bufferViews; }
    [Serializable] class LayoutImage { public int bufferView; }
    [Serializable] class LayoutView { public int byteOffset; }

    // Same-length edit inside the JSON chunk, so the container header and every binary offset stay valid.
    static byte[] ReplaceInJson(byte[] glb, string from, string to)
    {
      Assert.That(Encoding.UTF8.GetByteCount(to), Is.EqualTo(Encoding.UTF8.GetByteCount(from)));
      string json = GlbJson.Read(glb);
      int at = json.IndexOf(from, StringComparison.Ordinal);
      Assert.That(at, Is.GreaterThanOrEqualTo(0), from);
      Assert.That(json.IndexOf(from, at + 1, StringComparison.Ordinal), Is.EqualTo(-1), from);
      var edited = (byte[])glb.Clone();
      var replacement = Encoding.UTF8.GetBytes(to);
      Buffer.BlockCopy(replacement, 0, edited, 20 + Encoding.UTF8.GetByteCount(json.Substring(0, at)), replacement.Length);
      Assert.That(GlbJson.Read(edited), Is.EqualTo(json.Substring(0, at) + to + json.Substring(at + from.Length)));
      return edited;
    }
  }
}
