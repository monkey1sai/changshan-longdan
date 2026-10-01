"""Offline render of CPU-skinned runtime geometry. Supporting evidence, not browser QA."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'art-source/zhaoyun.blend'))
for o in list(bpy.context.scene.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.12, .16, .20, 1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .5


def track(o, point):
    o.rotation_euler = (Vector(point) - o.location).to_track_quat('-Z', 'Y').to_euler()


for pos, color, energy, size in [((3, -4, 5), (1, .9, .76), 450, 4), ((-3, -1, 3), (.65, .8, 1), 300, 3), ((1, 3, 4), (.7, .83, 1), 500, 3)]:
    data = bpy.data.lights.new('Softbox', 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
    ob = bpy.data.objects.new('Softbox', data)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    track(ob, (0, 0, 1))
bpy.ops.mesh.primitive_plane_add(size=200)
ground = bpy.context.object
mat = bpy.data.materials.new('Studio floor')
mat.diffuse_color = (.038, .052, .067, 1)
ground.data.materials.append(mat)
ground.location.z = -.08
bpy.ops.object.camera_add(location=(3.3, -5.5, 2.6))
camera = bpy.context.object
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 3.65
track(camera, (0, -.1, 1))

for pose in ['stance', 'run', 'guard', 'dodge']:
    objects = []
    for item in json.loads((ROOT / f'artifacts/character/{pose}.json').read_text()):
        points = item['positions']
        vertices = [(points[i], -points[i+2], points[i+1]) for i in range(0, len(points), 3)]
        indices = item['indices']
        faces = [indices[i:i+3] for i in range(0, len(indices), 3)]
        mesh = bpy.data.meshes.new(item['name'])
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        uv = item['uv']
        if uv:
            layer = mesh.uv_layers.new()
            for loop in mesh.loops:
                i = loop.vertex_index * 2
                layer.data[loop.index].uv = (uv[i], 1 - uv[i+1])
        for p in mesh.polygons:
            p.use_smooth = True
        obj = bpy.data.objects.new(item['name'], mesh)
        bpy.context.collection.objects.link(obj)
        objects.append(obj)
        mat = bpy.data.materials.get(item['material'])
        if mat is None:
            mat = bpy.data.materials.new('Equipment')
            mat.use_nodes = True
            p = mat.node_tree.nodes.get('Principled BSDF')
            p.inputs['Base Color'].default_value = (*item['color'], 1)
            p.inputs['Metallic'].default_value = item['metalness'] or 0
            p.inputs['Roughness'].default_value = item['roughness'] or .5
        mesh.materials.append(mat)
    scene.render.filepath = str(ROOT / f'artifacts/character/{pose}.png')
    bpy.ops.render.render(write_still=True)
    if pose == 'stance':
        camera.location = (.6, -1.7, 1.83)
        track(camera, (0, 0, 1.52))
        camera.data.ortho_scale = .95
        scene.render.filepath = str(ROOT / 'artifacts/character/face.png')
        bpy.ops.render.render(write_still=True)
        camera.location = (3.3, -5.5, 2.6)
        track(camera, (0, -.1, 1))
        camera.data.ortho_scale = 3.65
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
