using System;
using UnityEngine;

namespace Changshan.Character
{
  // Written as character.json in Player validation runs; scripts/unity-validate.mjs reads these field names.
  [Serializable]
  public sealed class CharacterImportReport
  {
    public string runId = "";
    public string status = "NOT_STARTED";
    public string failureCode = "";
    public string failureDetail = "";
    public string source = "";
    public long sourceBytes;
    public string sourceSha256 = "";
    public int loadCount;
    public int readyFrame = -1;
    public float loadSeconds;
    public string[] joints = Array.Empty<string>();
    public string[] bodyMaterials = Array.Empty<string>();
    public string[] weaponMaterials = Array.Empty<string>();
    public string[] materialShaders = Array.Empty<string>();
    public int bodyTriangles;
    public int weaponTriangles;
    public int triangles;
    public Vector3 bodyBoundsMin;
    public Vector3 bodyBoundsMax;
    public Vector3 weaponBoundsMin;
    public Vector3 weaponBoundsMax;
    public Vector3 tipLocal;
    public Vector3 tipBaseLocal;
    public Vector3 tipWorld;
    public Vector3 tipBaseWorld;
    public bool fallbackVisible;
    public bool modelVisible;
    public int gltfErrors;
    public int gltfWarnings;
    public string[] gltfMessages = Array.Empty<string>();
  }
}
