namespace Changshan.Character
{
  // Inspected values of the retained GLB (public/models/zhaoyun.glb and its manifest). An import must match all of them.
  public static class ZhaoYunContract
  {
    public const string StreamingAssetPath = "Characters/zhaoyun.glb";
    public const string ShaderVariantResources = "ZhaoYunShaderVariants";
    public const string SourceSha256 = "7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33";
    public const long SourceBytes = 3706788;

    public const string BodyNode = "SM_ZhaoYun";
    public const string WeaponNode = "SM_ZhaoYunSpear";
    public const int BodyTriangles = 27710;
    public const int WeaponTriangles = 1859;
    public const int Triangles = BodyTriangles + WeaponTriangles;

    // The body mesh stands on y = 0; its height is the glTF POSITION accessor maximum.
    public const float BodyHeight = 1.8495447f;
    // Spear local +Z, shared with the Web adapter (spearTipZ, spearTrailBaseZ) and the manifest weaponExtentsZ.
    public const float WeaponMinZ = -1.05f;
    public const float WeaponTipZ = 2.7f;
    public const float WeaponTipBaseZ = 1.25f;
    public const float Tolerance = 0.001f;

    // Skin joint order as stored in the GLB.
    public static readonly string[] Joints =
    {
      "pelvis", "spine_01", "spine_03", "neck", "head", "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r",
      "cape_01", "cape_02", "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r", "skirt_l", "skirt_r",
    };
    public static readonly string[] BodyMaterials = { "MAT_ZhaoYun" };
    public static readonly string[] WeaponMaterials = { "MAT_ZhaoYun", "MAT_ZhaoYunShaft" };
  }
}
