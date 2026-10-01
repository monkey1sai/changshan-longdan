"""Blender 4.5: dress Quaternius' CC0 humanoid in Zhao Yun's silver/green armour.

Coordinates are Blender Z-up, -Y forward. Runtime uses glTF Y-up, +Z forward.
The original skinned body, face, fingers and weights are retained.
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art-source/quaternius-base.glb'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = bpy.data.objects['SuperHero_Male']


def material(name, color, metal=0, rough=.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    return m


silver = material('Silver / brushed armour', (.49, .61, .69), .78, .3)
dark_silver = material('Silver / recessed scales', (.20, .29, .35), .65, .43)
gold = material('Gold / engraved borders', (.66, .41, .12), .75, .31)
green = material('Jade / woven tunic', (.025, .18, .095), 0, .86)
white = material('Ivory / trousers', (.72, .76, .69), 0, .9)
leather = material('Leather / boots and belts', (.055, .036, .026), 0, .66)
hair = material('Hair / ink black', (.014, .019, .022), 0, .65)
red = material('Crimson / spear tassel', (.40, .018, .015), 0, .75)
skin = material('Skin / warm complexion', (.64, .37, .23), 0, .62)

# Keep UVs and normal detail on the face. Cloth is separated by anatomical region.
original = body.data.materials[0]
body.data.materials.clear()
for m in [skin, green, white, leather, hair]:
    body.data.materials.append(m)
for face in body.data.polygons:
    c = sum((body.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
    p = body.matrix_world @ c
    z, x = p.z, abs(p.x)
    face.material_index = 0 if z > 1.59 or (x < .073 and z > 1.50) or (x > .70 and z > 1.3) else (3 if z < .25 else (2 if z < .98 else 1))
    face.use_smooth = True
# Preserve the supplied fine normal map for the skin without requiring the dark albedo.
for node in original.node_tree.nodes:
    if node.type == 'TEX_IMAGE' and node.image and 'Normal' in node.image.name:
        tex = skin.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = node.image
        normal = skin.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .45
        skin.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        skin.node_tree.links.new(normal.outputs['Normal'], skin.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
        break

# Build meshes in batches per material. Every decorative vertex follows one bone;
# skin underneath retains the original blended weights across joints.
batches = {}


def mesh_part(verts, faces, mat, bone):
    key = mat.name
    vs, fs, bs, _ = batches.setdefault(key, ([], [], [], mat))
    offset = len(vs)
    vs.extend(verts)
    fs.extend(tuple(i + offset for i in f) for f in faces)
    bs.extend([bone] * len(verts))


def ellipsoid(center, radii, mat, bone, rings=10, sides=20, top=math.pi):
    vs, fs = [], []
    for j in range(rings + 1):
        a = .001 + (top - .002) * j / rings
        for i in range(sides):
            t = 2 * math.pi * i / sides
            vs.append((center[0] + radii[0] * math.sin(a) * math.cos(t), center[1] + radii[1] * math.sin(a) * math.sin(t), center[2] + radii[2] * math.cos(a)))
    for j in range(rings):
        for i in range(sides):
            k = j * sides + i
            n = j * sides + (i + 1) % sides
            fs.append((k, n, n + sides, k + sides))
    mesh_part(vs, fs, mat, bone)


def tube(points, radius, mat, bone, sides=8):
    pts = [Vector(p) for p in points]
    vs, fs = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < .01:
            u = d.cross(Vector((0, 1, 0)))
        u.normalize()
        v = d.cross(u).normalized()
        for k in range(sides):
            a = k * 2 * math.pi / sides
            vs.append(tuple(p + radius * (math.cos(a) * u + math.sin(a) * v)))
    for i in range(len(pts) - 1):
        for k in range(sides):
            a = i * sides + k
            b = i * sides + (k + 1) % sides
            fs.append((a, b, b + sides, a + sides))
    fs.extend([tuple(range(sides - 1, -1, -1)), tuple(range((len(pts) - 1) * sides, len(pts) * sides))])
    mesh_part(vs, fs, mat, bone)


def plate(x, y, z, w, h, mat, bone):
    # Thin bevelled lamella, with a pointed lower edge rather than a round bead.
    outline = [(-.5, .5), (.5, .5), (.5, -.30), (.32, -.5), (-.32, -.5), (-.5, -.30)]
    vs = [(x + a*w, y, z + b*h) for a, b in outline]
    vs += [(x + a*w*.86, y-.005, z + b*h*.90) for a, b in outline]
    fs = [tuple(range(6, 12)), tuple(range(5, -1, -1))]
    fs += [(i, (i+1)%6, (i+1)%6+6, i+6) for i in range(6)]
    mesh_part(vs, fs, mat, bone)


def shell(rings, mat, bone, sides=32):
    """Elliptical fitted armour with rounded silhouette; rings=(height, width, depth, y)."""
    vs, fs = [], []
    for z, w, d, cy in rings:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            vs.append((w * math.cos(a), cy + d * math.sin(a), z))
    for j in range(len(rings) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            fs.append((a, b, b + sides, a + sides))
    mesh_part(vs, fs, mat, bone)


shell([(1.03, .16, .12, .01), (1.14, .18, .135, .01), (1.32, .235, .17, .005), (1.43, .225, .14, .015), (1.49, .115, .095, .015)], silver, 'spine_03')
shell([(1.45, .12, .098, .02), (1.54, .081, .068, .018), (1.575, .075, .065, .018)], green, 'neck_01')
# Curved overlapping lamellar scales across chest and skirt.
for row in range(6):
    z = 1.10 + row * .05
    for col in range(-3, 4):
        x = col * .052 + (row % 2) * .012
        y = -.148 * math.sqrt(max(.15, 1 - (x / .245) ** 2)) - .026
        plate(x, y-.008, z, .052, .058, silver if row % 2 else dark_silver, 'spine_03')
for s in [-1, 1]:
    tube([(s * .06, -.10, 1.48), (s * .15, -.137, 1.41), (s * .21, -.127, 1.32), (s * .17, -.13, 1.13)], .008, gold, 'spine_03')
    # Rounded layered pauldrons and upper/lower arm plates follow arm bones.
    side = 'l' if s > 0 else 'r'
    for i in range(3):
        ellipsoid((s * (.25 + i * .046), .057, 1.463 - i * .015), (.092, .135, .072), silver, 'upperarm_' + side, rings=6, sides=16, top=math.pi * .72)
    tube([(s * .22, -.068, 1.475), (s * .29, -.075, 1.463), (s * .38, -.04, 1.43)], .009, gold, 'upperarm_' + side)
    ellipsoid((s * .60, .065, 1.456), (.115, .066, .068), silver, 'lowerarm_' + side)
    for x in [.515, .665]:
        pts = [(s * x, .065 + .069 * math.cos(a), 1.455 + .071 * math.sin(a)) for a in [i * math.tau / 16 for i in range(17)]]
        tube(pts, .007, gold, 'lowerarm_' + side)
    # Fitted shin guards, knee caps, toe caps.
    ellipsoid((s * .114, -.027, .33), (.080, .075, .20), silver, 'calf_' + side)
    ellipsoid((s * .114, -.049, .54), (.086, .045, .077), silver, 'calf_' + side)
    tube([(s * .114, -.103, .16), (s * .114, -.107, .31), (s * .114, -.08, .48)], .007, gold, 'calf_' + side)
    ellipsoid((s * .114, -.054, .069), (.078, .147, .055), leather, 'foot_' + side)
    # Split tassets follow thighs; avoids a rigid skirt blocking the run cycle.
    ellipsoid((s * .15, -.099, .81), (.096, .048, .17), green, 'thigh_' + side)
    for row in range(4):
        for col in range(3):
            plate(s * (.084 + col * .057), -.146, .72 + row * .052, .053, .059, silver, 'thigh_' + side)
shell([(.95, .174, .128, .024), (1.015, .174, .128, .024)], leather, 'pelvis')
for z in [.955, 1.009]:
    tube([(.176 * math.cos(a), .024 + .13 * math.sin(a), z) for a in [i * math.tau / 32 for i in range(33)]], .007, gold, 'pelvis')
ellipsoid((0, -.12, .985), (.043, .017, .037), gold, 'pelvis')

# Open-faced helmet: keep brows, eyes, nose and jaw readable.
ellipsoid((0, .02, 1.711), (.119, .125, .128), silver, 'Head', rings=10, sides=32, top=math.pi / 2)
tube([(.121 * math.cos(a), .02 + .128 * math.sin(a), 1.713) for a in [i * math.tau / 40 for i in range(41)]], .009, gold, 'Head')
for s in [-1, 1]:
    ellipsoid((s * .105, .0, 1.656), (.022, .073, .063), silver, 'Head', rings=7, sides=12)
    tube([(s * .11, -.055, 1.70), (s * .117, -.058, 1.65), (s * .09, -.07, 1.607)], .005, gold, 'Head')
ellipsoid((0, -.103, 1.736), (.024, .023, .042), gold, 'Head')
ellipsoid((0, -.123, 1.737), (.012, .008, .023), green, 'Head')
# Slim plume with multiple curved strands instead of stacked cubes.
for i in range(9):
    x = (i - 4) * .005
    tube([(x, .012 + .27*(j/20)**1.7, 1.827 + .235*math.sin(j/20*1.95)) for j in range(21)], .004 if i % 2 else .005, white, 'Head', sides=6)
ellipsoid((0, .016, 1.831), (.024, .03, .038), red, 'Head')

for name, (verts, faces, bones, mat) in batches.items():
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    for bn in sorted(set(bones)):
        vg = obj.vertex_groups.new(name=bn)
        vg.add([i for i, b in enumerate(bones) if b == bn], 1, 'REPLACE')
    obj.parent = rig
    mod = obj.modifiers.new('Humanoid skin', 'ARMATURE')
    mod.object = rig

rig['source'] = 'Quaternius Universal Base Characters / Superhero Male / CC0 1.0'
rig['character'] = 'Zhao Yun / silver armour / jade tunic'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art-source/zhaoyun.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/models/zhaoyun.glb'), export_format='GLB', export_animations=False, export_extras=True)
payload = (ROOT / 'public/models/zhaoyun.glb').read_bytes()
json_bytes = struct.unpack_from('<I', payload, 12)[0]
document = json.loads(payload[20:20 + json_bytes])
primitives = [p for m in document['meshes'] for p in m['primitives']]
stats = {
    'source': 'Quaternius Universal Base Characters Standard / Superhero Male',
    'license': 'CC0-1.0',
    'vertices': sum(document['accessors'][a]['count'] for a in {p['attributes']['POSITION'] for p in primitives}),
    'triangles': sum(document['accessors'][p['indices']]['count'] // 3 for p in primitives),
    'bones': len(rig.data.bones),
    'bytes': (ROOT / 'public/models/zhaoyun.glb').stat().st_size,
}
(ROOT / 'art-source/zhaoyun-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
print('CHARACTER', json.dumps(stats))
