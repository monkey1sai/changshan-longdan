using System;
using System.IO;
using System.Linq;
using GLTFast;
using GLTFast.Logging;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace Changshan.Character.Editor
{
  // Creates only what is missing, so a configured checkout is never rewritten by the compile stage.
  public static class CharacterSetup
  {
    public const string PrefabPath = "Assets/Character/ZhaoYun.prefab";
    public const string FallbackMaterialPath = "Assets/Character/Materials/CharacterFallback.mat";
    public const string GroundMaterialPath = "Assets/Character/Materials/ValidationGround.mat";
    public const string ShaderVariantFolder = "Assets/Character/Resources/" + ZhaoYunContract.ShaderVariantResources;
    public const string SceneObjectName = "ZhaoYun";
    const string KeyLightName = "Key Light";
    const string GroundName = "Ground";

    public static void Ensure(string scenePath)
    {
      var fallbackMaterial = EnsureLitMaterial(FallbackMaterialPath, new Color(0.62f, 0.16f, 0.12f));
      var groundMaterial = EnsureLitMaterial(GroundMaterialPath, new Color(0.30f, 0.31f, 0.28f));
      EnsureShaderVariantMaterials();
      var prefab = EnsurePrefab(fallbackMaterial);
      EnsureScene(scenePath, prefab, groundMaterial);
    }

    static Material EnsureLitMaterial(string path, Color color)
    {
      var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
      if (existing != null) return existing;
      var shader = Shader.Find("Universal Render Pipeline/Lit");
      if (shader == null) throw new InvalidOperationException("URP Lit shader is unavailable");
      var material = new Material(shader) { name = Path.GetFileNameWithoutExtension(path) };
      material.SetColor("_BaseColor", color);
      EnsureFolder(Path.GetDirectoryName(path));
      AssetDatabase.CreateAsset(material, path);
      return material;
    }

    // Runtime glTFast materials need their shader variants in the Player. Materials made by the same generator from the
    // shipped GLB and kept in Resources put exactly those variants into the build; textures are runtime-only and cleared.
    static void EnsureShaderVariantMaterials()
    {
      if (AssetDatabase.IsValidFolder(ShaderVariantFolder) && AssetDatabase.FindAssets("t:Material", new[] { ShaderVariantFolder }).Length > 0)
        return;
      string source = Path.Combine(Application.streamingAssetsPath, ZhaoYunContract.StreamingAssetPath);
      var bytes = File.ReadAllBytes(source);
      var logger = new CollectingLogger();
      using var import = new GltfImport(deferAgent: new UninterruptedDeferAgent(), logger: logger);
      bool loaded = EditorSync.Run(() => import.Load(bytes, new Uri(Path.GetFullPath(source))), TimeSpan.FromMinutes(2));
      if (!loaded || import.MaterialCount == 0)
        throw new InvalidOperationException("E03 could not derive shader variants: " +
          string.Join("; ", logger.Items?.Select(item => item.ToString()) ?? Enumerable.Empty<string>()));
      EnsureFolder(ShaderVariantFolder);
      for (int i = 0; i < import.MaterialCount; i++)
      {
        var generated = import.GetMaterial(i);
        var variant = new Material(generated) { name = generated.name };
        foreach (int property in variant.GetTexturePropertyNameIDs()) variant.SetTexture(property, null);
        AssetDatabase.CreateAsset(variant, $"{ShaderVariantFolder}/{generated.name}.mat");
      }
    }

    static GameObject EnsurePrefab(Material fallbackMaterial)
    {
      var existing = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
      if (existing != null) return existing;
      var root = new GameObject(SceneObjectName);
      try
      {
        var fallback = new GameObject("Fallback");
        fallback.transform.SetParent(root.transform, false);
        // A plain stand-in at the GLB's scale: about 1.8 m tall, spear on local +Z from the contract's -1.05 to 2.7 m.
        AddPart(fallback.transform, PrimitiveType.Capsule, "Body", new Vector3(0, 0.75f, 0), Quaternion.identity, new Vector3(0.5f, 0.75f, 0.4f), fallbackMaterial);
        AddPart(fallback.transform, PrimitiveType.Sphere, "Head", new Vector3(0, 1.66f, 0), Quaternion.identity, Vector3.one * 0.3f, fallbackMaterial);
        float spearLength = ZhaoYunContract.WeaponTipZ - ZhaoYunContract.WeaponMinZ;
        AddPart(fallback.transform, PrimitiveType.Cylinder, "Spear", new Vector3(0, 0.02f, (ZhaoYunContract.WeaponTipZ + ZhaoYunContract.WeaponMinZ) / 2),
          Quaternion.Euler(90, 0, 0), new Vector3(0.05f, spearLength / 2, 0.05f), fallbackMaterial);
        var character = root.AddComponent<ZhaoYunCharacter>();
        character.Fallback = fallback;
        character.LoadOnStart = true;
        return PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
      }
      finally
      {
        UnityEngine.Object.DestroyImmediate(root);
      }
    }

    static void EnsureScene(string scenePath, GameObject prefab, Material groundMaterial)
    {
      var scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
      var roots = scene.GetRootGameObjects();
      bool changed = false;
      if (!roots.Any(root => root.name == SceneObjectName))
      {
        // Faces the validation camera (origin, looking +Z) in a three-quarter view.
        var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab, scene);
        instance.transform.SetPositionAndRotation(new Vector3(0, -1, 4.2f), Quaternion.Euler(0, 160, 0));
        changed = true;
      }
      if (!roots.Any(root => root.name == KeyLightName))
      {
        var lightObject = new GameObject(KeyLightName);
        SceneManager.MoveGameObjectToScene(lightObject, scene);
        lightObject.transform.rotation = Quaternion.Euler(40, -30, 0);
        var light = lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.2f;
        light.shadows = LightShadows.Soft;
        lightObject.AddComponent<UniversalAdditionalLightData>();
        changed = true;
      }
      if (!roots.Any(root => root.name == GroundName))
      {
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = GroundName;
        SceneManager.MoveGameObjectToScene(ground, scene);
        KeepRenderingComponents(ground);
        ground.transform.SetPositionAndRotation(new Vector3(0, -1, 4.2f), Quaternion.identity);
        ground.transform.localScale = new Vector3(0.6f, 1, 0.6f);
        ground.GetComponent<MeshRenderer>().sharedMaterial = groundMaterial;
        changed = true;
      }
      if (changed && !EditorSceneManager.SaveScene(scene)) throw new IOException("E03 could not save the validation scene");
    }

    static void AddPart(Transform parent, PrimitiveType type, string name, Vector3 position, Quaternion rotation, Vector3 scale, Material material)
    {
      var part = GameObject.CreatePrimitive(type);
      part.name = name;
      KeepRenderingComponents(part);
      part.transform.SetParent(parent, false);
      part.transform.SetLocalPositionAndRotation(position, rotation);
      part.transform.localScale = scale;
      part.GetComponent<MeshRenderer>().sharedMaterial = material;
    }

    // Drops primitive colliders without referencing the physics module, which this project does not enable.
    static void KeepRenderingComponents(GameObject target)
    {
      foreach (var component in target.GetComponents<Component>())
        if (!(component is Transform || component is MeshFilter || component is MeshRenderer)) UnityEngine.Object.DestroyImmediate(component);
    }

    static void EnsureFolder(string folder)
    {
      folder = folder.Replace('\\', '/');
      if (AssetDatabase.IsValidFolder(folder)) return;
      string parent = Path.GetDirectoryName(folder).Replace('\\', '/');
      EnsureFolder(parent);
      AssetDatabase.CreateFolder(parent, Path.GetFileName(folder));
    }
  }
}
