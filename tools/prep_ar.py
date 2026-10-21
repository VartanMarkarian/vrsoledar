# Prepare a VR-scene GLB for AR on the website, then export GLB (Android / web) + USDZ (iOS Quick Look).
#
# usage (Blender 4.x, background):
#   blender -b --factory-startup -P tools/prep_ar.py -- <in.glb> <out_basename> <height|length> <metres> [turn_degrees]
# e.g.
#   blender -b --factory-startup -P tools/prep_ar.py -- "_Робочі файли/Models/1.Gnome.glb" site/ar/gnome height 1.2 180
#   blender -b --factory-startup -P tools/prep_ar.py -- "_Робочі файли/Models/2.Turtle.glb" site/ar/turtle length 1.0 180
import bpy, sys, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
src, out, axis, size = argv[0], argv[1], argv[2], float(argv[3])
turn = float(argv[4]) if len(argv) > 4 else 0.0   # around the vertical, so the front faces the viewer (+Z in glTF)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

# only the model itself goes to AR: drop cameras, lights and empties that came with the file
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects:
    o.select_set(o in objs)
bpy.context.view_layer.objects.active = objs[0]

# drop the placement inside the VR scene (tens of metres away, scene scale); keep the model's own orientation
for o in objs:
    o.location = (0, 0, 0)
    o.scale = (1, 1, 1)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if turn:
    for o in objs:
        o.rotation_mode = 'XYZ'          # glTF imports use quaternions, which would ignore rotation_euler
        o.rotation_euler = (0, 0, math.radians(turn))
    bpy.ops.object.transform_apply(rotation=True)

def bounds():
    lo = mathutils.Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = mathutils.Vector(map(min, lo, w)); hi = mathutils.Vector(map(max, hi, w))
    return lo, hi

# real-world size
lo, hi = bounds()
dims = hi - lo
cur = dims.z if axis == "height" else max(dims.x, dims.y)
k = size / cur
for o in objs:
    o.scale = (k, k, k)
bpy.ops.object.transform_apply(scale=True)

# centred, standing on the floor (Blender is Z-up; the exporters convert to Y-up)
lo, hi = bounds()
shift = mathutils.Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
for o in objs:
    o.location = shift
bpy.ops.object.transform_apply(location=True)
lo, hi = bounds()
print("AR-DIMS", out, [round(x, 3) for x in (hi - lo)])

# matte salt: no gloss at all — full roughness, no metal, muted specular, no clear coat
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    for node in nt.nodes:
        if node.type != 'BSDF_PRINCIPLED':
            continue
        for name, value in (("Roughness", 1.0), ("Metallic", 0.0), ("Specular IOR Level", 0.15), ("Coat Weight", 0.0)):
            sock = node.inputs.get(name)
            if sock is None:
                continue
            for link in list(sock.links):
                nt.links.remove(link)
            sock.default_value = value
    # nodes that only fed roughness / metalness are now dangling: drop them so their textures aren't exported
    changed = True
    while changed:
        changed = False
        for node in list(nt.nodes):
            if node.type in ('TEX_IMAGE', 'SEPARATE_COLOR', 'SEPARATE_RGB', 'MATH', 'MAP_RANGE') and not any(o.links for o in node.outputs):
                nt.nodes.remove(node); changed = True

# ASCII texture names: iOS Quick Look can fail on non-ASCII paths inside a USDZ
base = out.replace("\\", "/").split("/")[-1]
for i, img in enumerate(bpy.data.images):
    img.name = "%s_tex%d" % (base, i)

# keep textures reasonable for phones
for img in bpy.data.images:
    if img.size[0] > 2048 or img.size[1] > 2048:
        s = 2048 / max(img.size)
        img.scale(int(img.size[0] * s), int(img.size[1] * s))

bpy.ops.export_scene.gltf(filepath=out + ".glb", export_format='GLB', use_selection=False,
                          export_image_format='JPEG', export_jpeg_quality=85, export_apply=True)
# Quick Look expects a Y-up stage in metres
bpy.ops.wm.usd_export(filepath=out + ".usdz", export_materials=True, export_textures=True,
                      convert_orientation=True, export_global_forward_selection='NEGATIVE_Z',
                      export_global_up_selection='Y')
print("AR-DONE", out)
