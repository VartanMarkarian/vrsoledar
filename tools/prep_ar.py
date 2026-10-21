# Prepare a VR-scene GLB for AR on the website, then export GLB (Android / web) + USDZ (iOS Quick Look).
#
# usage (Blender 4.x, background):
#   blender -b --factory-startup -P tools/prep_ar.py -- <in.glb> <out_basename> <height|length> <metres> [turn_degrees] [glow]
# "glow" adds a lamp-like aura that works in AR too: a warm pool of light on the floor and a soft halo
# around the object (crossed glowing planes, clear inside the silhouette so the object's colours stay as they are)
# e.g.
#   blender -b --factory-startup -P tools/prep_ar.py -- Models/1.Gnome.glb site/ar/gnome height 1.2 180
#   blender -b --factory-startup -P tools/prep_ar.py -- Models/2.Turtle.glb site/ar/turtle length 1.0 180
import bpy, sys, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
src, out, axis, size = argv[0], argv[1], argv[2], float(argv[3])
turn = float(argv[4]) if len(argv) > 4 else 0.0   # around the vertical, so the front faces the viewer (+Z in glTF)
glow = len(argv) > 5 and argv[5] == "glow"
GLOW_RGB = (1.0, 0.70, 0.42)                       # warm, like a salt lamp

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

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

def glow_material(name, img):
    """Self-lit, see-through material: black base, the image as emission, its alpha as opacity."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = 'BLENDED'
    if hasattr(mat, "blend_method"):
        mat.blend_method = 'BLEND'
    mat.use_backface_culling = False
    return mat

def glow_image(name, size, alpha_fn):
    import numpy as np
    n = size
    y, x = np.mgrid[0:n, 0:n]
    u = (x + 0.5) / n * 2 - 1           # -1..1 across the plane
    v = (y + 0.5) / n * 2 - 1
    a = np.clip(alpha_fn(u, v), 0, 1)
    px = np.zeros((n, n, 4), dtype=np.float32)
    px[..., 0], px[..., 1], px[..., 2] = GLOW_RGB
    px[..., 3] = a
    img = bpy.data.images.new(name, n, n, alpha=True)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img

def add_plane(name, w, h, mat, loc, rot):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    p = bpy.context.active_object
    p.name = name
    p.scale = (w, h, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    p.data.materials.append(mat)
    return p

if glow:
    import numpy as np
    lo, hi = bounds()
    dims = hi - lo
    foot = max(dims.x, dims.y)                      # widest footprint
    ht = dims.z

    # 1. warm pool of light on the floor, brightest under the object and fading out
    pool = glow_image("pool", 512, lambda u, v: 0.8 * np.exp(-((u * u + v * v) / 0.3)) * np.clip(1 - np.sqrt(u * u + v * v), 0, 1) ** 0.5)
    pd = min(foot * 3.4, foot + 1.2)              # big enough to read as light, never a huge disc
    add_plane("glow_floor", pd, pd, glow_material("glow_floor", pool), (0, 0, 0.003), (0, 0, 0))

    # 2. halo: four crossed vertical planes; clear inside the object's outline, a soft ring of light around it
    hw, hh = foot * 1.9, ht * 1.55                  # plane size
    ix, iy = (foot / 2) / (hw / 2), (ht / 2) / (hh / 2)   # object's half-size in plane units
    def halo(u, v):
        d = np.sqrt((u / ix) ** 2 + (v / iy) ** 2)  # 1.0 = roughly the object's outline
        inside = np.clip((d - 0.78) / 0.22, 0, 1)    # clear over the object itself
        outside = np.exp(-((np.maximum(d - 1.0, 0)) / 0.32) ** 2)
        edge = np.clip(1 - np.maximum(np.abs(u), np.abs(v)), 0, 1) ** 0.6   # never a hard plane edge
        return 0.32 * inside * outside * edge
    hmat = glow_material("glow_halo", glow_image("halo", 512, halo))
    for k in range(4):
        add_plane("glow_halo_%d" % k, hw, hh, hmat, (0, 0, ht / 2), (math.radians(90), 0, math.radians(45 * k)))
    print("AR-GLOW", out, "pool", round(pd, 2), "halo", round(hw, 2), "x", round(hh, 2))

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
