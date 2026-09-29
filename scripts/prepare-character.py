"""One-time conversion of the licensed Standard pack to a compact, editable source GLB."""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art-source/quaternius/Superhero_Male_FullBody.gltf'))
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH' and not obj.modifiers:
        bpy.data.objects.remove(obj, do_unlink=True)
for image in bpy.data.images:
    if image.size[0] > 1024:
        image.scale(1024, 1024)
    if image.size[0] > 0:
        image.pack()
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'art-source/quaternius-base.glb'), export_format='GLB', export_animations=False, export_extras=True)
