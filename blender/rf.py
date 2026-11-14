"""RogueFight - biblioteca Blender: cena toon, primitivas, rig por juntas e spritesheets.

Cada script desta pasta (blade.py, mage.py, ...) recria um modelo do zero e renderiza
a spritesheet em public/sprites. Veja o README.md desta pasta.
"""
import math
import os
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

TILT = 0.66                      # mesmo valor de src/game/config.ts
THETA = math.acos(TILT)          # inclinação da câmera a partir do topo (~48.7 graus)
SIN = math.sin(THETA)
S = {}                           # estado: câmera, sol, material de contorno
BASE = {}                        # transformações de repouso das juntas
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "sprites")   # destino das spritesheets
TMP = os.path.join(tempfile.gettempdir(), "roguefight_frames")   # frames avulsos e prévias
# Rotação Z da raiz para cada grupo de direção (o modelo é construído olhando para -Y):
#   dir 0 Leste, 1 Sudeste, 2 Sul (frente), 3 Nordeste, 4 Norte (costas).
# Oeste, Sudoeste e Noroeste saem do espelhamento horizontal no jogo.
DIRS = (90, 45, 0, 135, 180)
OUTLINE_W = 0.026


# ---------------------------------------------------------------- cores
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hx(h, a=1.0):
    h = h.lstrip("#")
    return (_lin(int(h[0:2], 16) / 255), _lin(int(h[2:4], 16) / 255), _lin(int(h[4:6], 16) / 255), a)


def mix(a, b, t):
    a, b = a.lstrip("#"), b.lstrip("#")
    out = "#"
    for i in (0, 2, 4):
        v = round(int(a[i:i + 2], 16) * (1 - t) + int(b[i:i + 2], 16) * t)
        out += f"{max(0, min(255, v)):02x}"
    return out


# ---------------------------------------------------------------- cena
def reset():
    """Limpa a cena e configura EEVEE para cel-shading com fundo transparente."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for d in list(blk):
            blk.remove(d)
    BASE.clear()

    sc = bpy.context.scene
    r = sc.render
    r.engine = "BLENDER_EEVEE"
    r.film_transparent = True
    r.use_freestyle = False          # contorno feito por Inverted Hull (mais rápido e estável)
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.resolution_percentage = 100
    r.filter_size = 1.0
    sc.view_settings.view_transform = "Standard"   # cores exatas dos hex do jogo
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1
    try:
        sc.eevee.taa_render_samples = 16
    except Exception as e:
        print("eevee samples:", e)

    # mundo preto: a luz vem só do sol, então o degrau do ColorRamp é previsível
    w = sc.world or bpy.data.worlds.new("World")
    sc.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.type = "ORTHO"
    cam_d.clip_start = 0.1
    cam_d.clip_end = 200
    cam = bpy.data.objects.new("Cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    S["cam"] = cam

    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 1.0
    sun_d.use_shadow = False         # sem sombra projetada: faixas de toon limpas
    sun = bpy.data.objects.new("Sun", sun_d)
    sc.collection.objects.link(sun)
    d = Vector((0.56, 0.56, -0.61)).normalized()   # luz vindo da esquerda-frente-cima
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    S["sun"] = sun

    ol = bpy.data.materials.new("Outline")
    _nodes(ol)
    nt = ol.node_tree
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = hx("#0a0614")
    nt.links.new(e.outputs[0], nt.nodes["Out"].inputs[0])
    ol.use_backface_culling = True
    S["outline"] = ol


def camera(ortho, w, h, tz=0.0, ty=0.0, top_down=False):
    """Câmera ortográfica inclinada THETA a partir do topo, mirando (0, ty, tz)."""
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    cam = S["cam"]
    cam.data.ortho_scale = ortho
    if top_down:
        cam.rotation_euler = (0, 0, 0)
        cam.location = (0, ty, 50)
    else:
        fwd = Vector((0, SIN, -TILT))
        cam.rotation_euler = (THETA, 0, 0)
        cam.location = Vector((0, ty, tz)) - fwd * 50


def _nodes(mat):
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.name = "Out"
    return nt


def toon(name, base, shadow=None, hi=None, t1=0.22, t2=0.82):
    """Diffuse -> ShaderToRGB -> ColorRamp (Constant) -> Emission: sombra dura de anime."""
    shadow = shadow or mix(mix(base, "#000000", 0.42), "#2a1a5e", 0.22)
    hi = hi or mix(base, "#ffffff", 0.35)
    mat = bpy.data.materials.new(name)
    nt = _nodes(mat)
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs[0].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].position = 0.0
    cr.elements[0].color = hx(shadow)
    cr.elements[1].position = t1
    cr.elements[1].color = hx(base)
    el = cr.elements.new(t2)
    el.color = hx(hi)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], nt.nodes["Out"].inputs[0])
    return mat


def glow(name, color, strength=1.0):
    """Material emissivo chapado (neon, olhos, runas)."""
    mat = bpy.data.materials.new(name)
    nt = _nodes(mat)
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "Em"
    em.inputs[0].default_value = hx(color)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Out"].inputs[0])
    return mat


def set_glow(mat, color):
    mat.node_tree.nodes["Em"].inputs[0].default_value = hx(color)


# ---------------------------------------------------------------- malhas
def _align(p0, p1):
    """Matriz que leva o eixo +Z (a partir da origem) para o segmento p0->p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(p0) @ q.to_matrix().to_4x4(), d.length


class B:
    """Construtor de malha: encadeia primitivas no mesmo bmesh."""

    def __init__(self):
        self.bm = bmesh.new()

    def sphere(self, c, r, sc=(1, 1, 1), seg=20, rot=None):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        m = Matrix.Translation(c)
        if rot:
            m = m @ Matrix.Rotation(math.radians(rot[1]), 4, rot[0])
        m = m @ Matrix.Diagonal((sc[0], sc[1], sc[2], 1))
        bmesh.ops.transform(self.bm, matrix=m, verts=res["verts"])
        return self

    def cone(self, p0, p1, r0, r1, seg=14, flat=None):
        m, length = _align(p0, p1)
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r0, radius2=max(r1, 0.0005), depth=length)
        pre = Matrix.Translation((0, 0, length / 2))
        if flat:  # achata a seção (x, y) antes de alinhar
            pre = Matrix.Diagonal((flat[0], flat[1], 1, 1)) @ pre
        bmesh.ops.transform(self.bm, matrix=m @ pre, verts=res["verts"])
        return self

    def box(self, c, size, rot=None):
        res = bmesh.ops.create_cube(self.bm, size=1)
        m = Matrix.Translation(c)
        if rot:
            for axis, deg in (rot if isinstance(rot[0], tuple) else (rot,)):
                m = m @ Matrix.Rotation(math.radians(deg), 4, axis)
        m = m @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        bmesh.ops.transform(self.bm, matrix=m, verts=res["verts"])
        return self

    def tri(self, p0, p1, p2, thick=0.03):
        """Prisma triangular fino (membranas de asa)."""
        p = [Vector(v) for v in (p0, p1, p2)]
        n = (p[1] - p[0]).cross(p[2] - p[0]).normalized() * (thick / 2)
        a = [self.bm.verts.new(v + n) for v in p]
        b = [self.bm.verts.new(v - n) for v in p]
        self.bm.faces.new(a)
        self.bm.faces.new(b[::-1])
        for i in range(3):
            k = (i + 1) % 3
            self.bm.faces.new((a[i], b[i], b[k], a[k]))
        return self

    def torus(self, R, r, seg=32, ring=8, c=(0, 0, 0)):
        bm = self.bm
        grid = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            row = []
            for j in range(ring):
                b = 2 * math.pi * j / ring
                x = (R + r * math.cos(b)) * math.cos(a)
                y = (R + r * math.cos(b)) * math.sin(a)
                row.append(bm.verts.new((x + c[0], y + c[1], r * math.sin(b) + c[2])))
            grid.append(row)
        for i in range(seg):
            for j in range(ring):
                bm.faces.new((grid[i][j], grid[(i + 1) % seg][j],
                              grid[(i + 1) % seg][(j + 1) % ring], grid[i][(j + 1) % ring]))
        return self


def mk(name, b, mat, parent=None, loc=(0, 0, 0), outline=None, smooth=True, bevel=0.0):
    """Cria o objeto. outline > 0 adiciona o casco invertido (contorno de anime)."""
    bm = b.bm
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    if bevel:
        bv = ob.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 2
    w = OUTLINE_W if outline is None else outline
    if w:
        me.materials.append(S["outline"])
        so = ob.modifiers.new("outline", "SOLIDIFY")
        so.thickness = w
        so.offset = 1
        so.use_flip_normals = True
        so.use_rim = False
        so.material_offset = 1
    ob.parent = parent
    ob.location = loc
    return ob


def joint(name, parent=None, loc=(0, 0, 0), rot0=(0, 0, 0), scale=1.0):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.parent = parent
    e.rotation_mode = "XYZ"
    BASE[name] = (Vector(loc), e, tuple(rot0), scale)
    e.location = loc
    rot(e)
    e.scale = (scale, scale, scale)
    return e


def rest():
    for loc, e, r0, sc in BASE.values():
        e.location = loc
        rot(e)
        e.scale = (sc, sc, sc)


def rot(j, x=0.0, y=0.0, z=0.0):
    r0 = BASE[j.name][2]
    j.rotation_euler = (math.radians(x + r0[0]), math.radians(y + r0[1]), math.radians(z + r0[2]))


def preview(out, root, poses, cell, ortho, tz, dirs=DIRS):
    """Folha de conferência: uma coluna por pose, uma linha por direção."""
    sheet(out, root, [("p", len(poses), lambda i, n: poses[i]())], cell, cell, ortho, tz, dirs)


def move(j, dx=0.0, dy=0.0, dz=0.0):
    j.location = BASE[j.name][0] + Vector((dx, dy, dz))


# ---------------------------------------------------------------- render
def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def _load(path):
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)


def _save(arr, path):
    h, w, _ = arr.shape
    im = bpy.data.images.new("rf_sheet", w, h, alpha=True)
    im.alpha_mode = "STRAIGHT"
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def sheet(out, root, anims, cell_w, cell_h, ortho, tz, dirs=DIRS):
    """Renderiza anims x direções e monta a spritesheet.
    anims: lista de (nome, n_frames, fn(i, n)). Linhas: para cada direção, cada animação."""
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    camera(ortho, cell_w, cell_h, tz=tz)
    cols = max(n for _, n, _ in anims)
    rows = len(anims) * len(dirs)
    big = np.zeros((rows * cell_h, cols * cell_w, 4), dtype=np.float32)
    warn = []
    row = 0
    for ang in dirs:
        for name, n, fn in anims:
            for i in range(n):
                rest()
                fn(i, n)
                root.rotation_euler = (0, 0, math.radians(ang))
                p = os.path.join(TMP, "f.png")
                render(p)
                a = _load(p)
                al = a[:, :, 3]
                if al[0].max() > 0.02 or al[-1].max() > 0.02 or al[:, 0].max() > 0.02 or al[:, -1].max() > 0.02:
                    warn.append(f"{name}[{i}]@{ang}")
                y0 = (rows - 1 - row) * cell_h   # linha 0 do Blender é a de baixo
                big[y0:y0 + cell_h, i * cell_w:(i + 1) * cell_w] = a
            row += 1
    _save(big, out)
    px = cell_w / ortho if cell_w >= cell_h else cell_h / ortho
    print(f"OK {os.path.basename(out)} {cols * cell_w}x{rows * cell_h} cell={cell_w}x{cell_h} "
          f"px/unit={px:.1f} anchor=({cell_w / 2:.0f},{cell_h / 2 + tz * SIN * px:.1f})")
    print("CORTADO:" if warn else "sem cortes", ", ".join(warn))


def still(out, w, h, ortho, tz=0.0, ty=0.0, top_down=False):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    camera(ortho, w, h, tz=tz, ty=ty, top_down=top_down)
    render(out)
    a = _load(out)
    al = a[:, :, 3]
    print(f"OK {os.path.basename(out)} {w}x{h} alpha_min={al.min():.2f} alpha_max={al.max():.2f}")
