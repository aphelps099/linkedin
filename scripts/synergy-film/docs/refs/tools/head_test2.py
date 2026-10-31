import bpy, bmesh, math, sys
from mathutils import Vector, Euler, Matrix
OUT = sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
# Blender convention: character faces -Y, character's LEFT = +X. Wedge tip is on the character's RIGHT (-X).
P = {
 'apex':(0.065,0.010,0.345),'Rtip':(-0.265,0.030,0.190),'L1':(0.210,0.050,0.225),'L2':(0.170,0.020,0.030),
 'chin':(-0.015,-0.090,0.000),'LR':(-0.140,-0.040,0.055),
 'BrowR':(-0.109,-0.150,0.212),'BrowL':(0.109,-0.150,0.212),'JawL':(0.109,-0.158,0.050),'JawR':(-0.109,-0.158,0.050),
 'BK1':(0.020,0.210,0.270),'BK2':(-0.120,0.200,0.140),'BK3':(0.120,0.190,0.090),'BK4':(-0.020,0.150,0.020),
}
# NOTE: X mirrored relative to viewer measurements: viewer-left wedge => character right => -X.
# The measurements were taken with viewer-right positive; mirror them:
# after mirroring, re-mirror so that wedge sits at -X (character right):
def mat(name,col,rough=0.5,metal=0.0,emit=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emit: b.inputs['Emission Color'].default_value=(*emit,1); b.inputs['Emission Strength'].default_value=6
    return m
cream=mat('cream',(0.72,0.6,0.43)); dark=mat('dark',(0.012,0.013,0.01),0.15); black=mat('black',(0.02,0.02,0.02),0.6); led=mat('led',(0,0,0),emit=(0.07,1.0,0.16))
head_root = bpy.data.objects.new('HEAD',None); bpy.context.collection.objects.link(head_root)
me = bpy.data.meshes.new('head'); bm = bmesh.new()
for k,v in P.items(): bm.verts.new(v)
bmesh.ops.convex_hull(bm, input=bm.verts, use_existing_faces=False)
bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('shell', me); bpy.context.collection.objects.link(ob); ob.parent=head_root; me.materials.append(cream)
def add(o,m): o.data.materials.append(m); o.parent=head_root; return o
bpy.ops.mesh.primitive_plane_add(size=1, location=(0,-0.161,0.131), rotation=(math.radians(90+2.8),0,0)); s=add(bpy.context.object,dark); s.scale=(0.19,0.135,1)
# eyes 2x3, pixel 0.007 pitch 0.0085
for ex in (-0.052, 0.040):
    for c in range(2):
        for r in range(3):
            bpy.ops.mesh.primitive_plane_add(size=0.007, location=(ex+c*0.0085,-0.1625,0.168-r*0.0085), rotation=(math.radians(90+2.8),0,0)); add(bpy.context.object,led)
for i in range(7):
    bpy.ops.mesh.primitive_plane_add(size=0.004, location=(-0.026+i*0.0085,-0.1625,0.085), rotation=(math.radians(90+2.8),0,0)); add(bpy.context.object,led)
for loc,rz in (((0.228,-0.005,0.118),-12),((-0.150,0.050,0.060),15)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0575, depth=0.048, location=loc, rotation=(0,math.radians(90),math.radians(rz))); add(bpy.context.object,black)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.015, location=(loc[0]-0.025*(1 if loc[0]>0 else -1),loc[1],loc[2]), rotation=(0,math.radians(90),math.radians(rz))); add(bpy.context.object,black)
def curve(name,pts,r):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for bp,pt in zip(sp.bezier_points,pts): bp.co=pt; bp.handle_left_type=bp.handle_right_type='AUTO'
    cu.bevel_depth=r; cu.bevel_resolution=4; o=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(o); o.parent=head_root; cu.materials.append(black); return o
curve('band',[(0.235,0.0,0.18),(0.248,0.012,0.295),(0.14,0.025,0.362),(0.0,0.045,0.358),(-0.14,0.08,0.29),(-0.165,0.07,0.15)],0.012)
curve('boom',[(0.235,-0.035,0.075),(0.20,-0.12,0.035),(0.13,-0.19,0.022),(0.09,-0.20,0.024)],0.0035)
curve('cable',[(0.235,0.0,0.065),(0.255,-0.02,-0.03),(0.17,-0.02,-0.12),(0.07,0.0,-0.16)],0.0025)
bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.065, location=(0.058,-0.20,0.024), rotation=(0,math.radians(90),math.radians(-8))); add(bpy.context.object,black)
# headband: torus segment approximated by bezier circle
# mic boom
bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.12, location=(0.0,0.0,-0.07)); add(bpy.context.object,black).scale=(0.4,0.4,1)
# roll head 7 deg (character left side up => rotate about Y)
head_root.rotation_euler=(0,math.radians(7),0)
sc = bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=24; sc.cycles.use_denoising=False
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes=True; bg=sc.world.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.55,0.53,0.5,1); bg.inputs[1].default_value=1.0
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sun.data.energy=2.5; sun.rotation_euler=(math.radians(35),math.radians(-15),math.radians(10)); sc.collection.objects.link(sun)
sc.render.resolution_x=1152; sc.render.resolution_y=800
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co; cam.lens=85
for name,yaw,zc in [('d_yaw0',0,0.10),('d_yawm8',-8,0.04),('d_yaw30',30,0.10),('d_side_left',90,0.15),('d_back34',150,0.2),('d_top',0,1.8)]:
    a=math.radians(yaw); co.location=(1.7*math.sin(a), -1.7*math.cos(a), zc)
    d = Vector((0.0,0,0.15))-co.location; co.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f'{OUT}/t2_{name}.png'; bpy.ops.render.render(write_still=True)
