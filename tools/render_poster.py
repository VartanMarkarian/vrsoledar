# Render a transparent three-quarter "photo" of an AR-ready GLB (the poster on the AR page).
#
# usage (Blender 4.x, background):
#   blender -b --factory-startup -P tools/render_poster.py -- <in.glb> <out.png> [size_px] [azimuth_deg]
import bpy, sys, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
px = int(argv[2]) if len(argv) > 2 else 800
az_deg = float(argv[3]) if len(argv) > 3 else 35.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# frame the object itself, not the glow planes around it (their materials are named glow_*)
body = [o for o in objs if not any(m and m.name.startswith("glow") for m in o.data.materials)] or objs

lo = mathutils.Vector((1e9,) * 3); hi = -lo
for o in body:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        lo = mathutils.Vector(map(min, lo, w)); hi = mathutils.Vector(map(max, hi, w))
centre = (lo + hi) / 2
radius = (hi - lo).length / 2

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 96 if px > 500 else 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = px
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
transforms = [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items]
scene.view_settings.view_transform = 'AgX' if 'AgX' in transforms else 'Filmic'

# camera: three-quarter view from the front (glTF +Z = Blender -Y), slightly from above
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 50
az, el = math.radians(az_deg), math.radians(14)
dist = radius / math.sin(math.radians(19)) * 1.05
cam.location = centre + mathutils.Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()

# soft warm key + cool rim + gentle fill and world light
world = bpy.data.worlds.new("w"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.06, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
def light(name, energy, colour, loc, size):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
    l.data.energy = energy; l.data.color = colour; l.data.size = size
    l.location = centre + mathutils.Vector(loc) * radius
    l.rotation_euler = (centre - l.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(l)
light("key", 900 * radius * radius, (1.0, 0.86, 0.72), (2.2, -2.6, 2.4), 2.5 * radius)
light("rim", 500 * radius * radius, (0.7, 0.8, 1.0), (-2.4, 2.2, 1.8), 2.0 * radius)
light("fill", 250 * radius * radius, (1, 1, 1), (-2.6, -2.0, 0.6), 3.0 * radius)

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("POSTER-DONE", out)
