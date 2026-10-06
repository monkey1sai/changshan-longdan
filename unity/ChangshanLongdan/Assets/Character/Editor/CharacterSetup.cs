using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
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
    public const string DummiesName = "Training Dummies";
    public const string DummyMaterialPath = "Assets/Character/Materials/TrainingDummy.mat";
    static readonly Vector3 SceneAnchor = new Vector3(0, -1, 4.2f);
    const float SceneYaw = 160;
    static readonly Vector3 GroundScale = new Vector3(1, 1, 1); // 10 m plane
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
      if (existing != null) return EnsureController(existing);
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
        root.AddComponent<ZhaoYunController>();
        return PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
      }
      finally
      {
        UnityEngine.Object.DestroyImmediate(root);
      }
    }

    // E04: a prefab made by E03 gains the input/combat driver once; an existing controller is left untouched.
    static GameObject EnsureController(GameObject prefab)
    {
      if (prefab.GetComponent<ZhaoYunController>() != null) return prefab;
      var contents = PrefabUtility.LoadPrefabContents(PrefabPath);
      try
      {
        contents.AddComponent<ZhaoYunController>();
        return PrefabUtility.SaveAsPrefabAsset(contents, PrefabPath);
      }
      finally
      {
        PrefabUtility.UnloadPrefabContents(contents);
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
        instance.transform.SetPositionAndRotation(SceneAnchor, Quaternion.Euler(0, SceneYaw, 0));
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
        ground.transform.localScale = GroundScale;
        ground.GetComponent<MeshRenderer>().sharedMaterial = groundMaterial;
        changed = true;
      }
      else
      {
        // E05: the 6 m ground of E03 left the outer dummies (4.2 m + 0.42 m body) off the edge; widen it once.
        var ground = roots.First(root => root.name == GroundName).transform;
        if (ground.localScale.x < GroundScale.x || ground.localScale.z < GroundScale.z)
        {
          ground.localScale = GroundScale;
          changed = true;
        }
      }
      if (!roots.Any(root => root.name == DummiesName))
      {
        AddTrainingDummies(scene, EnsureLitMaterial(DummyMaterialPath, new Color(0.36f, 0.43f, 0.55f)));
        changed = true;
      }
      if (changed && !EditorSceneManager.SaveScene(scene)) throw new IOException("E03 could not save the validation scene");
    }

    // E05: 20 static dummies around the character's start, 12 at 2.8 m and 8 at 4.2 m, leaving the 120° in front of the
    // character (towards the validation camera) open so the view stays clear.
    static void AddTrainingDummies(Scene scene, Material material)
    {
      var mapping = new LogicDisplayMapping(SceneAnchor, SceneYaw, ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      var root = new GameObject(DummiesName);
      SceneManager.MoveGameObjectToScene(root, scene);
      var items = new List<Transform>();
      int index = 0;
      foreach (var (count, radius) in new[] { (12, 2.8), (8, 4.2) })
        for (int i = 0; i < count; i++)
        {
          double angle = ArenaLayout.StartFacing + (60 + 240.0 * (i + 0.5) / count) * (Math.PI / 180);
          var position = mapping.ToDisplayPosition(ArenaLayout.StartX + Math.Sin(angle) * radius, 0, ArenaLayout.StartZ + Math.Cos(angle) * radius);
          var dummy = GameObject.CreatePrimitive(PrimitiveType.Capsule);
          dummy.name = $"Dummy {++index:00}";
          KeepRenderingComponents(dummy);
          dummy.transform.SetParent(root.transform, false);
          dummy.transform.SetPositionAndRotation(position + Vector3.up * 0.9f, Quaternion.identity);
          dummy.transform.localScale = new Vector3(0.84f, 0.9f, 0.84f); // 0.42 m body radius, 1.8 m tall
          dummy.GetComponent<MeshRenderer>().sharedMaterial = material;
          items.Add(dummy.transform);
        }
      root.AddComponent<TrainingDummies>().SetDummies(items);
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
