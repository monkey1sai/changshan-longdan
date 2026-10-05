using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Changshan.Character
{
  // Reads the JSON chunk of a binary glTF 2.0 container so an import can be compared with its source.
  public static class GlbJson
  {
    const uint Magic = 0x46546C67; // "glTF"
    const uint JsonChunk = 0x4E4F534A; // "JSON"

    public static string Read(byte[] glb)
    {
      if (glb == null || glb.Length < 20 || BitConverter.ToUInt32(glb, 0) != Magic || BitConverter.ToUInt32(glb, 4) != 2)
        throw new InvalidDataException("Not a binary glTF 2.0 container");
      long length = BitConverter.ToUInt32(glb, 12);
      if (BitConverter.ToUInt32(glb, 16) != JsonChunk || 20 + length > glb.Length)
        throw new InvalidDataException("Binary glTF has no complete JSON chunk");
      return Encoding.UTF8.GetString(glb, 20, (int)length);
    }

    public static GltfDocument Parse(byte[] glb) => JsonUtility.FromJson<GltfDocument>(Read(glb));
  }

  // Only the fields the contract checks. Absent arrays may deserialize as null or empty.
  [Serializable] public sealed class GltfDocument
  {
    public GltfNode[] nodes;
    public GltfSkin[] skins;
    public GltfMaterial[] materials;
    public GltfImage[] images;
    public GltfAnimation[] animations;
    public string[] extensionsRequired;
  }
  [Serializable] public sealed class GltfNode { public string name; public float[] translation; }
  [Serializable] public sealed class GltfSkin { public int[] joints; }
  [Serializable] public sealed class GltfMaterial { public string name; public bool doubleSided; }
  [Serializable] public sealed class GltfImage { public string uri; public string mimeType; }
  [Serializable] public sealed class GltfAnimation { public string name; }
}
