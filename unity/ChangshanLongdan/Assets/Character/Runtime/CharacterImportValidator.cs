using System.Linq;
using UnityEngine;

namespace Changshan.Character
{
  // Checks an instantiated import against ZhaoYunContract before it may replace the fallback.
  public static class CharacterImportValidator
  {
    public static bool Validate(GameObject root, CharacterImportReport report, out string code, out string detail)
    {
      var bodyNode = FindUnique(root.transform, ZhaoYunContract.BodyNode);
      var weaponNode = FindUnique(root.transform, ZhaoYunContract.WeaponNode);
      var body = bodyNode ? bodyNode.GetComponent<SkinnedMeshRenderer>() : null;
      var weaponFilter = weaponNode ? weaponNode.GetComponent<MeshFilter>() : null;
      var weaponRenderer = weaponNode ? weaponNode.GetComponent<MeshRenderer>() : null;
      if (body == null || body.sharedMesh == null || weaponFilter == null || weaponFilter.sharedMesh == null || weaponRenderer == null)
        return Reject("MESH_MISMATCH", "body skin or spear mesh is missing", out code, out detail);

      report.joints = body.bones.Select(bone => bone ? bone.name : "").ToArray();
      var missing = ZhaoYunContract.Joints.Where(joint => !report.joints.Contains(joint) || FindUnique(root.transform, joint) == null).ToArray();
      if (missing.Length > 0 || report.joints.Length != ZhaoYunContract.Joints.Length)
        return Reject("REQUIRED_BONE_MISSING", $"missing [{string.Join(",", missing)}], skin has {report.joints.Length} joints", out code, out detail);

      report.bodyMaterials = Names(body.sharedMaterials);
      report.weaponMaterials = Names(weaponRenderer.sharedMaterials);
      var materials = body.sharedMaterials.Concat(weaponRenderer.sharedMaterials).ToArray();
      report.materialShaders = materials.Select(material => material && material.shader ? material.shader.name : "").Distinct().ToArray();
      if (!report.bodyMaterials.SequenceEqual(ZhaoYunContract.BodyMaterials) || !report.weaponMaterials.SequenceEqual(ZhaoYunContract.WeaponMaterials) ||
          materials.Any(material => material == null || material.shader == null || !material.shader.isSupported))
        return Reject("MATERIAL_MISSING", $"body [{string.Join(",", report.bodyMaterials)}], spear [{string.Join(",", report.weaponMaterials)}]", out code, out detail);

      report.bodyTriangles = Triangles(body.sharedMesh);
      report.weaponTriangles = Triangles(weaponFilter.sharedMesh);
      report.triangles = report.bodyTriangles + report.weaponTriangles;
      if (report.bodyTriangles != ZhaoYunContract.BodyTriangles || report.weaponTriangles != ZhaoYunContract.WeaponTriangles)
        return Reject("MESH_MISMATCH", $"triangles body {report.bodyTriangles}, spear {report.weaponTriangles}", out code, out detail);

      var bodyBounds = body.sharedMesh.bounds;
      report.bodyBoundsMin = bodyBounds.min;
      report.bodyBoundsMax = bodyBounds.max;
      if (!Finite(bodyBounds.min) || !Finite(bodyBounds.max) || Mathf.Abs(bodyBounds.min.y) > ZhaoYunContract.Tolerance ||
          Mathf.Abs(bodyBounds.max.y - ZhaoYunContract.BodyHeight) > ZhaoYunContract.Tolerance)
        return Reject("BOUNDS_INVALID", $"body bounds {bodyBounds.min} to {bodyBounds.max}", out code, out detail);

      var weaponBounds = weaponFilter.sharedMesh.bounds;
      report.weaponBoundsMin = weaponBounds.min;
      report.weaponBoundsMax = weaponBounds.max;
      report.tipLocal = new Vector3(0, 0, ZhaoYunContract.WeaponTipZ);
      report.tipBaseLocal = new Vector3(0, 0, ZhaoYunContract.WeaponTipBaseZ);
      report.tipWorld = weaponNode.TransformPoint(report.tipLocal);
      report.tipBaseWorld = weaponNode.TransformPoint(report.tipBaseLocal);
      if (!Finite(weaponBounds.min) || !Finite(weaponBounds.max) || !Finite(report.tipWorld) || !Finite(report.tipBaseWorld) ||
          Mathf.Abs(weaponBounds.min.z - ZhaoYunContract.WeaponMinZ) > ZhaoYunContract.Tolerance ||
          Mathf.Abs(weaponBounds.max.z - ZhaoYunContract.WeaponTipZ) > ZhaoYunContract.Tolerance)
        return Reject("WEAPON_MISMATCH", $"spear bounds {weaponBounds.min} to {weaponBounds.max}", out code, out detail);

      code = "";
      detail = "";
      return true;
    }

    static bool Reject(string reason, string message, out string code, out string detail)
    {
      code = reason;
      detail = message;
      return false;
    }

    // Null when the name is absent or ambiguous, so a duplicated node cannot satisfy the contract.
    static Transform FindUnique(Transform root, string name)
    {
      Transform found = null;
      foreach (var candidate in root.GetComponentsInChildren<Transform>(true))
      {
        if (candidate.name != name) continue;
        if (found != null) return null;
        found = candidate;
      }
      return found;
    }

    static string[] Names(Material[] materials) => materials.Select(material => material ? material.name : "").ToArray();

    static int Triangles(Mesh mesh)
    {
      long indices = 0;
      for (int i = 0; i < mesh.subMeshCount; i++)
      {
        var subMesh = mesh.GetSubMesh(i);
        if (subMesh.topology == MeshTopology.Triangles) indices += subMesh.indexCount;
      }
      return (int)(indices / 3);
    }

    static bool Finite(Vector3 value) =>
      !float.IsNaN(value.x) && !float.IsNaN(value.y) && !float.IsNaN(value.z) &&
      !float.IsInfinity(value.x) && !float.IsInfinity(value.y) && !float.IsInfinity(value.z);
  }
}
