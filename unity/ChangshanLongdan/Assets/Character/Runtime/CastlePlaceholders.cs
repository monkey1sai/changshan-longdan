using System.Collections.Generic;
using Changshan.Combat;
using Changshan.View;
using UnityEngine;
using Rect = Changshan.Combat.Rect;

namespace Changshan.Character
{
  // E09 (A1): the castle as plain blocks from the shared layout so the camera's clearance and the roof cutaway can be
  // seen and recorded before the E10 art arrives: the four walls with the south gate, the keep and its stairs, six
  // barracks bodies with separate roof slabs (hidden by the cutaway), the braziers and the burning wrecks. Logic
  // rectangles go through the mapping like everything else; the ground plane is widened to the castle.
  public sealed class CastlePlaceholders : MonoBehaviour
  {
    public const float BarracksHeight = 4.2f, RoofThickness = 0.8f, StairsHeight = 0.8f, BrazierHeight = 1.0f, WreckHeight = 1.0f;
    public const float GroundScale = 12; // the authored 10 m plane covers the 112 m castle

    public IReadOnlyList<MeshRenderer> Roofs => roofs;
    readonly List<MeshRenderer> roofs = new List<MeshRenderer>();
    // E10: the blocks a delivered asset replaces (barracks bodies and roofs, braziers, wrecks); walls, keep and
    // stairs have no asset yet and always stay.
    readonly List<MeshRenderer> replaceable = new List<MeshRenderer>();
    public CastleAssets Assets { get; private set; }
    public bool AssetsShown => Assets != null && Assets.Status == CastleAssetStatus.Ready;
    public int BlockCount { get; private set; }
    Mesh cubeMesh;
    readonly List<Material> materials = new List<Material>();

    public static CastlePlaceholders Create(LogicDisplayMapping mapping, Material material)
    {
      var root = new GameObject("E09 Castle Placeholders");
      var castle = root.AddComponent<CastlePlaceholders>();
      castle.Build(mapping, material);
      var ground = GameObject.Find("Ground");
      if (ground != null && ground.transform.localScale.x < GroundScale)
        ground.transform.localScale = new Vector3(GroundScale, ground.transform.localScale.y, GroundScale);
      return castle;
    }

    void Build(LogicDisplayMapping mapping, Material material)
    {
      cubeMesh = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
      var wall = Tint(material, new Color(0.42f, 0.40f, 0.36f), "Wall");
      var roof = Tint(material, new Color(0.23f, 0.26f, 0.31f), "Roof");
      var prop = Tint(material, new Color(0.35f, 0.22f, 0.14f), "Prop");
      double inner = CastleGeometry.Inner, thick = CastleGeometry.WallThick, gate = CastleGeometry.GateHalf;
      float h = (float)CastleGeometry.WallHeight;
      // Walls: north, east, west full length; south split around the gate.
      Block(mapping, wall, "Wall N", new Rect(-inner - thick, inner + thick, -inner - thick, -inner), h);
      Block(mapping, wall, "Wall E", new Rect(inner, inner + thick, -inner, inner), h);
      Block(mapping, wall, "Wall W", new Rect(-inner - thick, -inner, -inner, inner), h);
      Block(mapping, wall, "Wall S left", new Rect(-inner - thick, -gate, inner, inner + thick), h);
      Block(mapping, wall, "Wall S right", new Rect(gate, inner + thick, inner, inner + thick), h);
      var keep = CastleGeometry.Keep;
      Block(mapping, wall, "Keep", keep, (float)CastleGeometry.KeepHeight);
      Block(mapping, roof, "Keep hall", new Rect(-11.5, 11.5, keep.MinZ + 6, keep.MaxZ - 6), 9, (float)CastleGeometry.KeepHeight);
      Block(mapping, wall, "Stairs", CastleGeometry.Stairs, StairsHeight);
      for (int i = 0; i < CastleGeometry.Barracks.Count; i++)
      {
        replaceable.Add(Block(mapping, wall, $"Barracks {i}", CastleGeometry.Barracks[i], BarracksHeight));
        var slab = Block(mapping, roof, $"Barracks roof {i}", CastleGeometry.Roofs[i], RoofThickness, BarracksHeight);
        roofs.Add(slab);
        replaceable.Add(slab);
      }
      foreach (var (x, z) in CastleGeometry.Braziers) replaceable.Add(Block(mapping, prop, "Brazier", new Rect(x - 0.6, x + 0.6, z - 0.6, z + 0.6), BrazierHeight));
      foreach (var w in CastleGeometry.Wrecks) replaceable.Add(Block(mapping, prop, "Wreck", w, WreckHeight));
    }

    MeshRenderer Block(LogicDisplayMapping mapping, Material material, string name, Rect r, float height, float bottom = 0)
    {
      // Built from the built-in mesh like the crowd capsules: no collider (collision is the logic arena's job) and no
      // Physics module.
      var box = new GameObject(name);
      box.AddComponent<MeshFilter>().sharedMesh = cubeMesh;
      box.AddComponent<MeshRenderer>();
      box.transform.SetParent(transform, false);
      double cx = (r.MinX + r.MaxX) / 2, cz = (r.MinZ + r.MaxZ) / 2;
      box.transform.SetPositionAndRotation(mapping.ToDisplayPosition(cx, bottom + height / 2.0, cz), mapping.ToDisplayRotation(0));
      box.transform.localScale = new Vector3((float)(r.MaxX - r.MinX), height, (float)(r.MaxZ - r.MinZ));
      var renderer = box.GetComponent<MeshRenderer>();
      if (material != null) renderer.sharedMaterial = material;
      BlockCount++;
      return renderer;
    }

    void OnDestroy()
    {
      foreach (var m in materials) if (m != null) Destroy(m);
      materials.Clear();
    }

    // Registers the asset loader (so its status is observable here); once it is Ready the blocks it covers are hidden
    // and the roof flags drive the asset roof nodes instead of the slabs.
    public void AttachAssets(CastleAssets assets)
    {
      Assets = assets;
      if (!AssetsShown) return;
      foreach (var r in replaceable) r.enabled = false;
    }

    // Whether barracks i currently shows a roof, whichever representation is on screen.
    public bool RoofVisible(int i) => AssetsShown ? Assets.Roofs[i] != null && Assets.Roofs[i].activeSelf : roofs[i].enabled;

    public void ShowRoofs(bool[] visible)
    {
      if (AssetsShown)
      {
        Assets.ShowRoofs(visible);
        return;
      }
      for (int i = 0; i < roofs.Count && i < visible.Length; i++)
        if (roofs[i].enabled != visible[i]) roofs[i].enabled = visible[i];
    }

    Material Tint(Material source, Color color, string name)
    {
      if (source == null) return null;
      var m = new Material(source) { name = source.name + " " + name };
      materials.Add(m);
      if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
      if (m.HasProperty("_Color")) m.SetColor("_Color", color);
      return m;
    }
  }
}
