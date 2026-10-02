"""Rig the supplied posed mesh on a copy. Run with Blender --disable-autoexec.

Source geometry, UVs and packed textures are retained. Landmarks below are explicit
for the inspected C8DFF5... model, not a generic auto-rig for arbitrary characters.
"""
import bpy, bmesh, hashlib, json, math, os, sys
from mathutils import Vector, Matrix

args=sys.argv[sys.argv.index('--')+1:]
destination, evidence=args[0], args[1]
with open(bpy.data.filepath, 'rb') as source_file:
    source_hash = hashlib.sha256(source_file.read()).hexdigest()
if source_hash != 'c8dff5bf7d43c04040a5f661b64a8702b5bedaf5fb2f69debd10a626dcc901a9':
    raise RuntimeError('Source hash differs; re-audit before preparing this asset')
body=next(o for o in bpy.data.objects if o.type=='MESH')
if body.name!='ZhaoYun' or len(body.data.polygons)!=30000:
    raise RuntimeError('Unexpected source; re-audit before preparing this asset')
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000015)
bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
start=Vector((-.619,-.203,.945));end=Vector((.797,-.179,-.750))
axis=(end-start).normalized();total=(end-start).length
def weapon_vertex(co):
    if min((co-Vector((-.19,-.19,.36))).length,(co-Vector((.25,-.20,-.12))).length)<.075:
        return False
    u=(co-start).dot(axis)/total
    closest=start+axis*(u*total)
    r=(co-closest).length
    limit=.075
    if u<.22:limit=.105
    elif .22<=u<.30:limit=.11
    elif u>.82:limit=.08
    # The white tassel below the upper guard is original weapon geometry.
    if .27<u<.36 and co.y<-.14:limit=.11
    return -.025<u<1.035 and r<limit
selected=[f for f in bm.faces if sum(weapon_vertex(v.co) for v in f.verts)>=2]
if not 250<len(selected)<5000:
    raise RuntimeError(f'Invalid weapon separation ({len(selected)} faces)')
indices={f.index for f in selected}
bm.to_mesh(body.data);bm.free()
weapon=body.copy();weapon.data=body.data.copy();weapon.name='SM_ZhaoYunSpear'
bpy.context.collection.objects.link(weapon)
def keep_faces(obj, keep_weapon):
    m=bmesh.new();m.from_mesh(obj.data);m.faces.ensure_lookup_table()
    discard=[f for f in m.faces if (f.index in indices)!=keep_weapon]
    bmesh.ops.delete(m,geom=discard,context='FACES')
    loose=[v for v in m.verts if not v.link_faces]
    bmesh.ops.delete(m,geom=loose,context='VERTS')
    boundary=[e for e in m.edges if e.is_boundary]
    if boundary:bmesh.ops.holes_fill(m,edges=boundary,sides=0)
    bmesh.ops.triangulate(m,faces=list(m.faces))
    bmesh.ops.recalc_face_normals(m,faces=list(m.faces))
    m.to_mesh(obj.data);m.free();obj.data.update()
keep_faces(body,False);keep_faces(weapon,True)
body.name='SM_ZhaoYun'
# Blender Z-up/-Y-forward -> game/glTF Y-up/+Z-forward. Exporter converts axes.
# Keep Blender native coordinates; move the sole to z=0.
floor=-.951379120349884
for v in body.data.vertices:v.co.z-=floor
landmarks={
 'pelvis':((0,0,-.09),(0,0,.01),None),
 'spine_01':((0,0,.01),(0,0,.22),'pelvis'),
 'spine_03':((0,0,.22),(.025,-.014,.47),'spine_01'),
 'neck':((.025,-.014,.47),(.055,-.055,.56),'spine_03'),
 'head':((.055,-.055,.56),(.055,-.055,.82),'neck'),
 'upperarm_l':((.24,-.025,.34),(.36,-.055,.10),'spine_03'),
 'lowerarm_l':((.36,-.055,.10),(.25,-.20,-.12),'upperarm_l'),
 'hand_l':((.25,-.20,-.12),(.22,-.23,-.17),'lowerarm_l'),
 'upperarm_r':((-.25,-.04,.34),(-.38,-.07,.22),'spine_03'),
 'lowerarm_r':((-.38,-.07,.22),(-.19,-.19,.36),'upperarm_r'),
 'hand_r':((-.19,-.19,.36),(-.16,-.21,.39),'lowerarm_r'),
 'thigh_l':((.12,0,-.11),(.28,-.03,-.49),'pelvis'),
 'calf_l':((.28,-.03,-.49),(.37,-.04,-.87),'thigh_l'),
 'foot_l':((.37,-.04,-.87),(.43,-.19,-.91),'calf_l'),
 'thigh_r':((-.12,0,-.11),(-.27,-.025,-.49),'pelvis'),
 'calf_r':((-.27,-.025,-.49),(-.28,-.045,-.87),'thigh_r'),
 'foot_r':((-.28,-.045,-.87),(-.39,-.18,-.91),'calf_r'),
 'cape_01':((0,.10,.35),(0,.13,-.20),'spine_03'),
 'cape_02':((0,.13,-.20),(0,.18,-.74),'cape_01'),
 'skirt_l':((.21,0,-.15),(.42,.025,-.68),'pelvis'),
 'skirt_r':((-.21,0,-.15),(-.44,.025,-.68),'pelvis'),
}
# Hand anchors lie on the inspected shaft so the supplied closed palms retain
# their offset relative to the grip when their bind pose is corrected at runtime.
for side in ('l','r'):
    a,b,parent=landmarks['hand_'+side]
    old=Vector(a);delta=end-start
    corrected=start+delta*((old-start).dot(delta)/delta.length_squared)
    landmarks['hand_'+side]=(tuple(corrected),tuple(corrected+(Vector(b)-old)),parent)
    a,b,parent=landmarks['lowerarm_'+side]
    landmarks['lowerarm_'+side]=(a,tuple(corrected),parent)
arm_data=bpy.data.armatures.new('ARM_ZhaoYun')
arm=bpy.data.objects.new('ARM_ZhaoYun',arm_data);bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
segments={}
for name,(a,b,parent) in landmarks.items():
    a=Vector(a);b=Vector(b);a.z-=floor;b.z-=floor
    bone=arm_data.edit_bones.new(name);bone.head=a;bone.tail=b
    if parent:bone.parent=arm_data.edit_bones[parent]
    segments[name]=(a,b)
bpy.ops.object.mode_set(mode='OBJECT')
groups={name:body.vertex_groups.new(name=name) for name in landmarks}
def distance(point,name):
    a,b=segments[name];d=b-a
    return (point-(a+d*max(0,min(1,(point-a).dot(d)/d.length_squared)))).length
def weights(point):
    x,y,z=point.x,point.y,point.z+floor
    s='l' if x>0 else 'r'
    original=Vector((x,y,z))
    for side,center in [('r',Vector((-.19,-.19,.36))),('l',Vector((.25,-.20,-.12)))]:
        if (original-center).length<.105:return [('hand_'+side,1)]
    if z>.49:return [('head',1)]
    if z>.44:return [('head',.65),('neck',.35)]
    # Cape/skirts must not inherit arm/leg weights merely because they touch.
    cape=y>.105 and z<.38
    outer_cloth=z<-.23 and abs(x)>.46
    center_cloth=z<-.28 and abs(x)<.17
    if cape or outer_cloth or center_cloth:
        t=max(0,min(1,(.05-z)/.55))
        return [('cape_01',1-t),('cape_02',t)]
    if z<-.82:return [(f'foot_{s}',1)]
    if z<-.18:
        names=[f'thigh_{s}',f'calf_{s}',f'foot_{s}']
        if z>-.35:names.append('pelvis')
        if abs(x)>.37 and z>-.60 and y>.01:names=[f'skirt_{s}','pelvis']
    else:
        names=['pelvis','spine_01','spine_03','neck']
        if abs(x)>.17 and z<.43:names += [f'upperarm_{s}',f'lowerarm_{s}',f'hand_{s}']
    ranked=sorted((distance(point,n),n) for n in names)[:4]
    # Smooth joints, keep rigid extremities; normalize exact max-four influences.
    width=.075 if z<-.18 else .065
    raw=[(n,math.exp(-(d-ranked[0][0])**2/(width*width))) for d,n in ranked]
    total=sum(w for _,w in raw)
    return [(n,w/total) for n,w in raw if w/total>.0001]
for v in body.data.vertices:
    ws=weights(v.co);total=sum(w for _,w in ws)
    for n,w in ws:groups[n].add([v.index],w/total,'REPLACE')
modifier=body.modifiers.new('ZhaoYunSkin','ARMATURE');modifier.object=arm
body.parent=arm
# The same spear driver coordinates as the original game: -1.05..2.7 on +Z.
# In Blender that is -Y. Preserve radial detail; stretch only the shaft axis.
forward=-axis
side=Vector((0,1,0)).cross(forward).normalized();up=forward.cross(side).normalized()
min_z=min((v.co-start).dot(forward) for v in weapon.data.vertices)
max_z=max((v.co-start).dot(forward) for v in weapon.data.vertices)
# The source is a fused posed reconstruction. Replace the interrupted/bent
# middle pole with one continuous shaft; retain its two original blade/guards.
wm=bmesh.new();wm.from_mesh(weapon.data)
middle=[]
for face in wm.faces:
    u=(face.calc_center_median()-start).dot(axis)/total
    if .30<u<.82:middle.append(face)
bmesh.ops.delete(wm,geom=middle,context='FACES')
bmesh.ops.delete(wm,geom=[v for v in wm.verts if not v.link_faces],context='VERTS')
wm.to_mesh(weapon.data);wm.free()
for v in weapon.data.vertices:
    relative=v.co-start
    z=-1.05+3.75*((relative.dot(forward)-min_z)/(max_z-min_z))
    v.co=Vector((relative.dot(side),-z,relative.dot(up)))
weapon.location=(0,0,0)
shaft_material=bpy.data.materials.new('MAT_ZhaoYunShaft');shaft_material.use_nodes=True
shader=shaft_material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value=(.32,.36,.35,1)
shader.inputs['Metallic'].default_value=.35;shader.inputs['Roughness'].default_value=.65
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.025,depth=3.20,location=(0,-.65,0),rotation=(math.pi/2,0,0))
shaft=bpy.context.object;shaft.data.materials.append(shaft_material)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='DESELECT');shaft.select_set(True);weapon.select_set(True)
bpy.context.view_layer.objects.active=weapon;bpy.ops.object.join()
for material in body.data.materials:
    material.name='MAT_ZhaoYun'
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':
            node.inputs['Roughness'].default_value=.65
            node.inputs['Metallic'].default_value=.15
# Gate before export. No unrelated lights/camera/text blocks are exported.
for obj in (body,weapon):
    obj.data.validate(clean_customdata=False)
    obj.data.update()
body.data.calc_loop_triangles();weapon.data.calc_loop_triangles()
triangles=len(body.data.loop_triangles)+len(weapon.data.loop_triangles)
assert triangles<40000
assert all(v.groups and len(v.groups)<=4 and abs(sum(g.weight for g in v.groups)-1)<.001 for v in body.data.vertices)
assert len(arm_data.bones)==len(landmarks)
report={'source':'c8dff5bf7d43c04040a5f661b64a8702b5bedaf5fb2f69debd10a626dcc901a9','triangles':triangles,'bodyTriangles':len(body.data.loop_triangles),'weaponTriangles':len(weapon.data.loop_triangles),'bones':len(arm_data.bones),'maxInfluences':max(len(v.groups) for v in body.data.vertices),'unweighted':sum(not v.groups for v in body.data.vertices),'animations':'procedural game driver; no authored source clips','weaponAxis':'+Z in glTF','weaponExtents':[-1.05,2.7],'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file)} for i in bpy.data.images if i.source!='VIEWER']}
os.makedirs(os.path.dirname(destination),exist_ok=True)
with open(os.path.join(evidence,'prepared-audit.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(evidence,'zhaoyun-rigged-copy.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in (body,weapon,arm):obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=destination,export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_image_format='JPEG',export_image_quality=93)
print('PREPARED',json.dumps(report))
