using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Changshan.Character;
using Changshan.Character.Editor;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  public sealed class CharacterSourceEditTests
  {
    static string StreamingCopy => Path.Combine(Application.streamingAssetsPath, ZhaoYunContract.StreamingAssetPath);
    static string RepositoryFile(string relative) => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", relative));

    [Test] public void StreamingCopyIsByteIdenticalToRetainedGlb()
    {
      var copy = File.ReadAllBytes(StreamingCopy);
      var retained = File.ReadAllBytes(RepositoryFile("public/models/zhaoyun.glb"));
      Assert.That(copy.LongLength, Is.EqualTo(ZhaoYunContract.SourceBytes));
      Assert.That(copy.SequenceEqual(retained), Is.True);
      using var sha = SHA256.Create();
      Assert.That(string.Concat(sha.ComputeHash(copy).Select(value => value.ToString("x2"))), Is.EqualTo(ZhaoYunContract.SourceSha256));
    }

    [Test] public void ContractMatchesRetainedManifest()
    {
      var manifest = JsonUtility.FromJson<Manifest>(File.ReadAllText(RepositoryFile("public/models/zhaoyun.manifest.json")));
      Assert.That(manifest.export.sha256, Is.EqualTo(ZhaoYunContract.SourceSha256));
      Assert.That(manifest.export.bytes, Is.EqualTo(ZhaoYunContract.SourceBytes));
      Assert.That(manifest.export.triangles, Is.EqualTo(ZhaoYunContract.Triangles));
      Assert.That(manifest.export.bodyTriangles, Is.EqualTo(ZhaoYunContract.BodyTriangles));
      Assert.That(manifest.export.weaponTriangles, Is.EqualTo(ZhaoYunContract.WeaponTriangles));
      Assert.That(manifest.export.bones, Is.EqualTo(ZhaoYunContract.Joints.Length));
      Assert.That(manifest.runtime.weaponTipZ, Is.EqualTo(ZhaoYunContract.WeaponTipZ).Within(1e-6f));
      Assert.That(manifest.runtime.weaponExtentsZ, Is.EqualTo(new[] { ZhaoYunContract.WeaponMinZ, ZhaoYunContract.WeaponTipZ }).Within(1e-6f));
      Assert.That(manifest.runtime.rootMotion, Is.False);
    }

    [Test] public void GlbDeclaresContractJointsMaterialsAndEmbeddedData()
    {
      var gltf = GlbJson.Parse(File.ReadAllBytes(StreamingCopy));
      Assert.That(gltf.skins, Has.Length.EqualTo(1));
      Assert.That(gltf.skins[0].joints.Select(index => gltf.nodes[index].name), Is.EqualTo(ZhaoYunContract.Joints));
      Assert.That(gltf.materials.Select(material => material.name), Is.EqualTo(ZhaoYunContract.WeaponMaterials));
      Assert.That(gltf.nodes.Count(node => node.name == ZhaoYunContract.BodyNode), Is.EqualTo(1));
      Assert.That(gltf.nodes.Count(node => node.name == ZhaoYunContract.WeaponNode), Is.EqualTo(1));
      Assert.That(gltf.images, Has.Length.EqualTo(3));
      Assert.That(gltf.images.All(image => string.IsNullOrEmpty(image.uri)), Is.True, "external image URI");
      Assert.That(gltf.extensionsRequired ?? Array.Empty<string>(), Is.Empty);
      Assert.That(gltf.animations ?? Array.Empty<GltfAnimation>(), Is.Empty);
    }

    [Test] public void ShippedShaderVariantsUseTheGltfMetallicShader()
    {
      var variants = Resources.LoadAll<Material>(ZhaoYunContract.ShaderVariantResources);
      Assert.That(variants.Select(material => material.name).OrderBy(name => name, StringComparer.Ordinal),
        Is.EqualTo(ZhaoYunContract.WeaponMaterials.OrderBy(name => name, StringComparer.Ordinal)));
      Assert.That(variants.Select(material => material.shader ? material.shader.name : ""), Is.All.EqualTo("Shader Graphs/glTF-pbrMetallicRoughness"));
    }

    [Test] public void CharacterPrefabShowsItsFallbackBeforeLoading()
    {
      var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterSetup.PrefabPath);
      Assert.That(prefab, Is.Not.Null);
      var character = prefab.GetComponent<ZhaoYunCharacter>();
      Assert.That(character, Is.Not.Null);
      Assert.That(character.LoadOnStart, Is.True);
      Assert.That(character.Fallback, Is.Not.Null);
      Assert.That(character.Fallback.transform.IsChildOf(prefab.transform), Is.True);
      Assert.That(character.Fallback.activeSelf, Is.True);
      var renderers = character.Fallback.GetComponentsInChildren<MeshRenderer>(true);
      Assert.That(renderers, Has.Length.EqualTo(3));
      Assert.That(renderers.All(renderer => renderer.enabled && renderer.sharedMaterial != null), Is.True);
    }

    [Serializable] class Manifest { public ManifestExport export; public ManifestRuntime runtime; }
    [Serializable] class ManifestExport { public string sha256; public long bytes; public int triangles, bodyTriangles, weaponTriangles, bones; }
    [Serializable] class ManifestRuntime { public float weaponTipZ; public float[] weaponExtentsZ; public bool rootMotion; }
  }
}
