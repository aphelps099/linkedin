"""Baked vertex animation for crowds (flocks, falling paper, fireflies).

Simulate in numpy, write a .pc2 point cache, and play it back with Blender's
Mesh Cache modifier. Playback is deterministic, interpolates between frames
(so Cycles motion blur works), and never needs a frame-change handler.

    verts, faces = instance_mesh(template_verts, template_faces, n)
    obj = mesh_from(verts, faces, 'Flock')
    positions = np.zeros((frames, n * len(template_verts), 3), np.float32)
    ... fill positions per frame ...
    write_pc2(path, positions, start=frame_a)
    attach_pc2(obj, path, frame_a)
"""

import os
import struct

import bpy
import numpy as np


def write_pc2(path, positions, start=1.0, rate=1.0):
    """positions: float array (n_frames, n_verts, 3) in object space."""
    positions = np.ascontiguousarray(positions, dtype='<f4')
    n_frames, n_verts, _ = positions.shape
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<12siiffi', b'POINTCACHE2\0', 1, n_verts, float(start), float(rate), n_frames))
        fh.write(positions.tobytes())
    return path


def attach_pc2(obj, path, frame_start, name='Cache'):
    """Play `path` on obj from film frame `frame_start` (cache frame 0)."""
    mod = obj.modifiers.new(name, 'MESH_CACHE')
    mod.cache_format = 'PC2'
    mod.filepath = os.path.abspath(path)
    mod.frame_start = frame_start
    mod.frame_scale = 1.0
    mod.interpolation = 'LINEAR'
    mod.time_mode = 'FRAME'
    mod.play_mode = 'SCENE'
    mod.forward_axis = 'POS_Y'
    mod.up_axis = 'POS_Z'
    return mod


def instance_mesh(template_verts, template_faces, n):
    """Repeat a small template mesh n times; returns (verts (n*k,3), faces list)."""
    tv = np.asarray(template_verts, dtype=np.float32)
    k = len(tv)
    verts = np.tile(tv, (n, 1))
    faces = []
    for i in range(n):
        base = i * k
        faces.extend([tuple(base + j for j in f) for f in template_faces])
    return verts, faces


def mesh_from(verts, faces, name, coll=None, mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.asarray(verts).tolist(), [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(obj)
    if mat is not None:
        me.materials.append(mat)
    return obj


def transform_instances(template_verts, rotations, positions, scales=None):
    """Place one template per instance.

    rotations: (n, 3, 3) matrices, positions: (n, 3), scales: (n,) or None.
    Returns (n * k, 3) vertex positions for a single frame.
    """
    tv = np.asarray(template_verts, dtype=np.float32)
    v = np.einsum('nij,kj->nki', rotations, tv)
    if scales is not None:
        v = v * np.asarray(scales, dtype=np.float32)[:, None, None]
    v = v + np.asarray(positions, dtype=np.float32)[:, None, :]
    return v.reshape(-1, 3)


def look_rotations(forward, up=(0.0, 0.0, 1.0)):
    """(n,3) forward vectors -> (n,3,3) rotation matrices mapping +Y to forward, +Z to ~up."""
    f = np.asarray(forward, dtype=np.float32)
    f = f / np.maximum(np.linalg.norm(f, axis=1, keepdims=True), 1e-8)
    u = np.broadcast_to(np.asarray(up, dtype=np.float32), f.shape)
    r = np.cross(f, u)
    bad = np.linalg.norm(r, axis=1) < 1e-6
    r[bad] = (1.0, 0.0, 0.0)
    r = r / np.linalg.norm(r, axis=1, keepdims=True)
    u2 = np.cross(r, f)
    return np.stack([r, f, u2], axis=2)  # columns: x->r, y->f, z->u2
