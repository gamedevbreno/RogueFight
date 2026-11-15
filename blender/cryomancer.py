import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import rf

importlib.reload(rf)
PREVIEW = bool(globals().get("PREVIEW")) or "--preview" in sys.argv
from math import sin, cos, pi
B = rf.B

rf.reset()
M = dict(
    dress=rf.toon("dress", "#7fb6e8", "#2f5a94", "#d4ecff"),
    trim=rf.toon("trim", "#2c4674", "#101c34", "#48689c"),
    skin=rf.toon("skin", "#e4f2ff", "#9cb8dc", "#ffffff"),
    hair=rf.toon("hair", "#f4fbff", "#9cc4e4", "#f4fbff"),
    ice=rf.glow("ice", "#68e8ff"),
    white=rf.glow("white", "#f4feff"),
    dark=rf.glow("dark", "#0a1830"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


def crystal(c, h, r):
    """Cristal de duas pontas (dois cones de 4 lados)."""
    x, y, z = c
    return B().cone((x, y, z), (x, y, z + h), r, 0, seg=4).cone((x, y, z), (x, y, z - h * 0.6), r, 0, seg=4)


# Tecelã de Cristal: figura flutuante de vestido de gelo, coroa de cristais e
# estilhaços orbitando. Olha para -Y.
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 1.0))
j("skirt", "body", (0, 0, 0))
rf.mk("skirt", B().cone((0, 0, 0.12), (0, 0.03, -0.5), 0.17, 0.4, seg=8), M["dress"], J["skirt"], smooth=False)
j("skirt2", "skirt", (0, 0.03, -0.5))
sp = B().cone((0, 0, 0.03), (0, 0.05, -0.36), 0.38, 0.06, seg=8)
for a in range(6):
    x, y = 0.3 * cos(a * 1.047), 0.3 * sin(a * 1.047)
    sp.cone((x, y, 0), (x * 1.25, y * 1.25 + 0.04, -0.46), 0.09, 0, seg=4)
rf.mk("icicles", sp, M["dress"], J["skirt2"], smooth=False)
rf.mk("hem", B().torus(0.385, 0.03, seg=8, c=(0, 0.03, 0.0)), M["ice"], J["skirt2"], outline=0)

j("spine", "body", (0, 0, 0.1))
rf.mk("torso", B().cone((0, 0, -0.02), (0, 0, 0.34), 0.12, 0.155, flat=(1, 0.8)), M["trim"], J["spine"])
rf.mk("collar", B().cone((0, 0, 0.42), (0, 0.02, 0.24), 0.1, 0.3, seg=6, flat=(1, 0.8)), M["dress"], J["spine"], smooth=False)
rf.mk("gem", crystal((0, -0.17, 0.26), 0.09, 0.05), M["ice"], J["spine"], outline=0.012, smooth=False)

j("head", "spine", (0, 0, 0.45), rot0=(-20, 0, 0), scale=1.12)
rf.mk("face", B().sphere((0, 0, 0.2), 0.235, (1, 0.96, 1), seg=26), M["skin"], J["head"])
for sx in (1, -1):
    x = 0.094 * sx
    rf.mk("eye", B().sphere((x, -0.212, 0.17), 0.058, (0.9, 0.3, 1.1)), M["ice"], J["head"], outline=0.01)
    rf.mk("lash", B().box((x, -0.222, 0.238), (0.125, 0.02, 0.022), rot=("Y", 10 * sx)), M["dark"], J["head"], outline=0)
hair = B().sphere((0, 0.035, 0.235), 0.255, (1.04, 1.0, 1.0), seg=22)
for p0, p1, r in [((0.0, -0.19, 0.39), (-0.03, -0.255, 0.28), 0.08), ((0.12, -0.16, 0.38), (0.18, -0.23, 0.28), 0.07),
                  ((-0.12, -0.16, 0.38), (-0.19, -0.22, 0.29), 0.07),
                  ((0.24, -0.03, 0.25), (0.3, -0.08, -0.3), 0.075), ((-0.24, -0.03, 0.25), (-0.3, -0.08, -0.3), 0.075)]:
    hair.cone(p0, p1, r, 0.012, seg=8)
rf.mk("hair", hair, M["hair"], J["head"])
j("hairb", "head", (0, 0.17, 0.2))
rf.mk("hb1", B().sphere((0, 0.03, -0.16), 0.23, (1, 0.6, 1.2)), M["hair"], J["hairb"])
j("hairb2", "hairb", (0, 0.04, -0.36))
rf.mk("hb2", B().cone((0, 0, 0.08), (0, 0.03, -0.44), 0.19, 0.02, seg=10, flat=(1, 0.5)), M["hair"], J["hairb2"])
cr = B()
for k, (a, h) in enumerate(((0, 0.42), (0.75, 0.3), (-0.75, 0.3), (1.5, 0.2), (-1.5, 0.2))):
    cr.cone((0.22 * sin(a), -0.1 * cos(a) + 0.03, 0.4), (0.3 * sin(a), -0.14 * cos(a) + 0.03, 0.4 + h), 0.055, 0, seg=4)
rf.mk("crown", cr, M["ice"], J["head"], outline=0.014, smooth=False)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.2 * sx, 0, 0.33))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.24), 0.06, 0.055), M["trim"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.24))
    rf.mk("sleeve" + s, B().cone((0, 0, 0.03), (0, 0, -0.24), 0.06, 0.13, seg=6), M["dress"], J["fore" + s], smooth=False)
    rf.mk("hand" + s, B().sphere((0, 0, -0.27), 0.05), M["skin"], J["fore" + s])

# estilhaços orbitando: 4 cristais => girar 90 graus fecha o loop
j("orbit", "body", (0, 0, 0.3))
for k in range(4):
    a = k * pi / 2
    rf.mk(f"shard{k}", crystal((0.62 * cos(a), 0.62 * sin(a), 0.1 * (-1) ** k), 0.2, 0.075), M["ice"], J["orbit"], outline=0.016, smooth=False)
# cristal que cresce entre as mãos ao carregar
j("charge", "spine", (0, -0.5, 0.2))
rf.mk("charge", crystal((0, 0, 0), 0.24, 0.1), M["white"], J["charge"], outline=0.02, smooth=False)


def sway(t, back=0.0):
    rf.rot(J["skirt"], back + 4 * sin(2 * pi * t), 0, 4 * sin(2 * pi * t + 1))
    rf.rot(J["skirt2"], back * 0.8 + 8 * sin(2 * pi * t - 1), 0, 6 * sin(2 * pi * t))
    rf.rot(J["hairb"], back + 5 * sin(2 * pi * t + 0.4), 0, 5 * sin(2 * pi * t))
    rf.rot(J["hairb2"], back * 0.6 + 9 * sin(2 * pi * t - 0.8), 0, 7 * sin(2 * pi * t - 0.5))


def float_(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.rot(J["orbit"], 0, 0, 90 * t)
    rf.rot(J["spine"], 3 * b)
    sway(t, 8)
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["arm" + s], 0, -(40 + 6 * b) * sx, 0)
        rf.rot(J["fore" + s], -30)
    J["charge"].scale = (0, 0, 0)


def charging(i, n):
    k = (i + 1) / n
    rf.move(J["body"], dz=0.06 * k)
    rf.rot(J["orbit"], 0, 0, 30 * k)
    J["orbit"].scale = (1 - 0.45 * k, 1 - 0.45 * k, 1)     # os estilhaços se fecham
    rf.rot(J["spine"], -6 * k)
    sway(0.2 * i, -8 * k)
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["arm" + s], -78 * k, 14 * sx * k, 0)
        rf.rot(J["fore" + s], -16)
    s_ = 0.4 + 1.0 * k
    J["charge"].scale = (s_, s_, s_)


ANIMS = [("float", 4, float_), ("charging", 3, charging)]
if PREVIEW:
    rf.preview(rf.TMP + "/cryomancer_prev.png", J["root"], [lambda: float_(0, 4), lambda: float_(2, 4), lambda: charging(0, 3), lambda: charging(2, 3)], 320, 3.0, 1.0)
else:
    rf.sheet(rf.OUT + "/enemy_cryomancer.png", J["root"], ANIMS, 256, 256, 3.0, 1.0)
