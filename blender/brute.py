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
rf.OUTLINE_W = 0.036
M = dict(
    rock=rf.toon("rock", "#8a7074", "#3a2c30", "#b89ea2"),
    rock2=rf.toon("rock2", "#6c565a", "#2c2024", "#967c82"),
    magma=rf.glow("magma", "#ff6a14"),
    hot=rf.glow("hot", "#ffd23a"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


def rock(c, r, sc=(1, 1, 1), rot=None):
    """Pedra facetada (esfera de poucos segmentos com sombreamento chapado)."""
    return B().sphere(c, r, sc, seg=7, rot=rot)


# Golem de Magma: blocos de rocha vulcânica unidos por juntas de magma incandescente. Olha para -Y.
j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.72))
rf.mk("pelvis", rock((0, 0, 0), 0.4, (1.15, 0.9, 0.7)), M["rock2"], J["hips"], smooth=False)
for s, sx in (("L", 1), ("R", -1)):
    j("leg" + s, "hips", (0.3 * sx, 0, -0.12))
    rf.mk("hipj" + s, B().sphere((0, 0, 0), 0.16), M["magma"], J["leg" + s], outline=0)
    rf.mk("leg" + s, rock((0, -0.02, -0.34), 0.3, (0.95, 1.1, 1.25)), M["rock"], J["leg" + s], smooth=False)

j("spine", "hips", (0, 0, 0.2))
rf.mk("waist", B().sphere((0, 0, 0.06), 0.3, (1.2, 1, 0.6)), M["magma"], J["spine"], outline=0)
rf.mk("torso", rock((0, 0, 0.62), 0.7, (1.15, 0.9, 0.95), rot=("Z", 25)), M["rock"], J["spine"], smooth=False)
rf.mk("core", B().sphere((0, -0.56, 0.6), 0.2, (1, 0.5, 1.2)), M["hot"], J["spine"], outline=0.024)
veins = B()
for x, z, a in ((0.3, 0.85, 30), (-0.32, 0.8, -35), (0.26, 0.38, -25), (-0.24, 0.36, 28)):
    veins.box((x, -0.52, z), (0.34, 0.08, 0.06), rot=("Y", a))
rf.mk("veins", veins, M["magma"], J["spine"], outline=0)
spk = B()
for x, y, h in ((0.25, 0.25, 0.5), (-0.2, 0.3, 0.6), (0.0, 0.1, 0.42)):
    spk.cone((x, y, 1.05), (x * 1.5, y * 1.6, 1.05 + h), 0.2, 0, seg=5)
rf.mk("backspk", spk, M["rock2"], J["spine"], smooth=False)

j("head", "spine", (0, -0.2, 1.22), rot0=(-12, 0, 0))
rf.mk("head", rock((0, 0, 0.05), 0.3, (1.1, 1.05, 0.85), rot=("Z", 15)), M["rock2"], J["head"], smooth=False)
for sx in (1, -1):
    rf.mk("eye", B().box((0.12 * sx, -0.27, 0.07), (0.13, 0.06, 0.06), rot=("Y", 20 * sx)), M["hot"], J["head"], outline=0.014)
rf.mk("mouth", B().box((0, -0.26, -0.08), (0.2, 0.06, 0.05)), M["magma"], J["head"], outline=0)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.86 * sx, 0, 0.86))
    rf.mk("shj" + s, B().sphere((0, 0, 0), 0.22), M["magma"], J["arm" + s], outline=0)
    rf.mk("pad" + s, rock((0.06 * sx, 0, 0.14), 0.42, (1.1, 1.05, 0.85), rot=("Z", 40 * sx)), M["rock2"], J["arm" + s], smooth=False)
    rf.mk("upper" + s, rock((0.04 * sx, 0, -0.36), 0.26, (0.9, 0.95, 1.3)), M["rock"], J["arm" + s], smooth=False)
    j("fore" + s, "arm" + s, (0.04 * sx, 0, -0.66))
    rf.mk("elj" + s, B().sphere((0, 0, 0), 0.17), M["magma"], J["fore" + s], outline=0)
    rf.mk("fist" + s, rock((0, -0.03, -0.46), 0.42, (1, 1.05, 1.15), rot=("Z", 20 * sx)), M["rock"], J["fore" + s], smooth=False)
    rf.mk("knuck" + s, B().box((0, -0.38, -0.5), (0.4, 0.08, 0.08)), M["magma"], J["fore" + s], outline=0)


def arms(l=(0, 0, 0), r=(0, 0, 0), fl=0.0, fr=0.0):
    rf.rot(J["armL"], *l)
    rf.rot(J["armR"], *r)
    rf.rot(J["foreL"], fl)
    rf.rot(J["foreR"], fr)


def walk(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=-0.02 + 0.06 * abs(cos(ph)))
    rf.rot(J["hips"], 0, 6 * sin(ph), 0)
    rf.rot(J["spine"], 8, -5 * sin(ph), 8 * sin(ph))
    rf.rot(J["head"], 0, 0, -6 * sin(ph))
    rf.rot(J["legL"], -26 * sin(ph))
    rf.rot(J["legR"], 26 * sin(ph))
    arms((24 * sin(ph), -8, 0), (-24 * sin(ph), 8, 0), -20, -20)


def pound(i, n):
    if i < 2:       # punhos erguidos, corpo arqueado para trás
        k = (0.6, 1.0)[i]
        rf.move(J["hips"], dz=0.04 * k)
        rf.rot(J["spine"], -18 * k)
        rf.rot(J["head"], 14 * k)
        arms((-165 * k, 12, 0), (-165 * k, -12, 0), -16, -16)
    else:           # impacto: punhos cravados no chão
        rf.move(J["hips"], dz=-0.26)
        rf.rot(J["spine"], 40)
        rf.rot(J["head"], -26)
        rf.rot(J["legL"], -30); rf.rot(J["legR"], -30)
        arms((-62, -8, 0), (-62, 8, 0), -22, -22)


ANIMS = [("walk", 4, walk), ("pound", 3, pound)]
if PREVIEW:
    rf.preview(rf.TMP + "/brute_prev.png", J["root"], [lambda: walk(0, 4), lambda: walk(1, 4), lambda: pound(1, 3), lambda: pound(2, 3)], 320, 5.0, 1.25)
else:
    rf.sheet(rf.OUT + "/enemy_brute.png", J["root"], ANIMS, 320, 320, 5.0, 1.25)
rf.OUTLINE_W = 0.026
