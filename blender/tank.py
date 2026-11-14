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
    armor=rf.toon("armor", "#a6ff3d", "#4f9a1e", "#e2ffab"),
    dark=rf.toon("dark", "#2a5220", "#10240c", "#40782e"),
    metal=rf.toon("metal", "#16300f", "#081406", "#28501c"),
    bone=rf.toon("bone", "#f4ffd8", "#a8c878", "#ffffff"),
    visor=rf.glow("visor", "#f0ffb8"),
    core=rf.glow("core", "#f0ffb8"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# colosso blindado: tronco em barril, ombreiras gigantes, punhos enormes
j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.78))
rf.mk("pelvis", B().box((0, 0, 0), (0.78, 0.52, 0.36)), M["metal"], J["hips"], bevel=0.08)
rf.mk("tasset", B().box((0, -0.27, -0.08), (0.36, 0.08, 0.4)), M["armor"], J["hips"], bevel=0.04)
for s, sx in (("L", 1), ("R", -1)):
    j("leg" + s, "hips", (0.3 * sx, 0, -0.1))
    rf.mk("thigh" + s, B().cone((0, 0, 0.06), (0, 0, -0.32), 0.21, 0.2, seg=12), M["dark"], J["leg" + s])
    j("shin" + s, "leg" + s, (0, 0, -0.3))
    rf.mk("boot" + s, B().box((0, -0.05, -0.19), (0.4, 0.54, 0.38)), M["armor"], J["shin" + s], bevel=0.07)
    rf.mk("toe" + s, B().box((0, -0.31, -0.3), (0.34, 0.1, 0.16)), M["metal"], J["shin" + s], bevel=0.03)

j("spine", "hips", (0, 0, 0.14))
rf.mk("torso", B().sphere((0, 0, 0.5), 0.62, (1.16, 0.86, 0.95), seg=28), M["armor"], J["spine"])
rf.mk("gut", B().sphere((0, -0.08, 0.2), 0.5, (1.05, 0.9, 0.7), seg=20), M["dark"], J["spine"])
rf.mk("plate", B().box((0, -0.5, 0.56), (0.62, 0.1, 0.4), rot=("X", -8)), M["dark"], J["spine"], bevel=0.05)
rf.mk("core", B().sphere((0, -0.56, 0.56), 0.13, (1, 0.5, 1)), M["core"], J["spine"], outline=0.02)

j("head", "spine", (0, -0.14, 1.06), rot0=(-12, 0, 0))
rf.mk("helm", B().sphere((0, 0, 0.06), 0.27, (1, 1.05, 0.9), seg=20).box((0, 0.02, 0.33), (0.07, 0.36, 0.16)), M["dark"], J["head"])
rf.mk("visor", B().box((0, -0.25, 0.07), (0.36, 0.09, 0.08)), M["visor"], J["head"], outline=0.014, bevel=0.02)
rf.mk("chin", B().box((0, -0.2, -0.08), (0.3, 0.14, 0.14)), M["metal"], J["head"], bevel=0.04)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.8 * sx, 0, 0.78))
    pad = B().sphere((0.04 * sx, 0, 0.06), 0.42, (1.05, 1.05, 0.82), seg=22)
    rf.mk("pad" + s, pad, M["armor"], J["arm" + s])
    rf.mk("rim" + s, B().torus(0.4, 0.05, seg=24, c=(0.04 * sx, 0, -0.08)), M["metal"], J["arm" + s], outline=0)
    spk = B()
    for ax, ay in ((0.0, 0.0), (0.2, -0.14), (0.2, 0.16)):
        spk.cone((ax * sx + 0.04 * sx, ay, 0.3), (ax * sx * 1.9 + 0.08 * sx, ay * 1.6, 0.62), 0.1, 0, seg=8)
    rf.mk("spk" + s, spk, M["bone"], J["arm" + s])
    rf.mk("upper" + s, B().cone((0.03 * sx, 0, -0.1), (0.03 * sx, 0, -0.52), 0.2, 0.2, seg=12), M["dark"], J["arm" + s])
    j("fore" + s, "arm" + s, (0.03 * sx, 0, -0.5))
    rf.mk("gaunt" + s, B().cone((0, 0, 0.04), (0, 0, -0.44), 0.24, 0.31, seg=12), M["armor"], J["fore" + s])
    fist = B().sphere((0, -0.02, -0.6), 0.3, (1, 1.05, 0.88), seg=18)
    rf.mk("fist" + s, fist, M["metal"], J["fore" + s])
    kn = B()
    for kx in (-0.15, 0, 0.15):
        kn.sphere((kx, -0.28, -0.62), 0.07)
    rf.mk("kn" + s, kn, M["bone"], J["fore" + s], outline=0.016)


def visor(red):
    rf.set_glow(M["visor"], "#ff3030" if red else "#f0ffb8")
    rf.set_glow(M["core"], "#ff5a3c" if red else "#f0ffb8")


def arms(l=(0, 0, 0), r=(0, 0, 0), fl=0.0, fr=0.0):
    rf.rot(J["armL"], *l)
    rf.rot(J["armR"], *r)
    rf.rot(J["foreL"], fl)
    rf.rot(J["foreR"], fr)


def walk(i, n):
    ph = 2 * pi * i / n
    visor(False)
    rf.move(J["hips"], dz=-0.03 + 0.06 * abs(cos(ph)))
    rf.rot(J["hips"], 0, 5 * sin(ph), 0)
    rf.rot(J["spine"], 6, -4 * sin(ph), 7 * sin(ph))
    rf.rot(J["head"], 0, 0, -6 * sin(ph))
    for s, p in (("L", ph), ("R", ph + pi)):
        rf.rot(J["leg" + s], -30 * sin(p))
        rf.rot(J["shin" + s], 8 + 30 * max(0, cos(p)))
    arms((22 * sin(ph), -8, 0), (-22 * sin(ph), 8, 0), -22, -22)


def leap(i, n):
    visor(True)
    if i < 2:   # agachando para o salto
        k = (i + 1) / 2
        rf.move(J["hips"], dz=-0.26 * k)
        rf.rot(J["spine"], 20 * k)
        rf.rot(J["head"], -14 * k)
        for s in ("L", "R"):
            rf.rot(J["leg" + s], -46 * k)
            rf.rot(J["shin" + s], 78 * k)
        arms((40 * k, -14, 0), (40 * k, 14, 0), -50 * k, -50 * k)
    else:       # no ar: punhos erguidos acima da cabeça
        rf.move(J["hips"], dz=0.02)
        rf.rot(J["spine"], -14)
        rf.rot(J["head"], 16)
        rf.rot(J["legL"], -34); rf.rot(J["shinL"], 70)
        rf.rot(J["legR"], 12); rf.rot(J["shinR"], 56)
        arms((-168, 14, 0), (-168, -14, 0), -18, -18)


def slam(i, n):
    visor(i == 0)
    k = [1.0, 0.62, 0.25][i]
    rf.move(J["hips"], dz=-0.3 * k)
    rf.rot(J["spine"], 38 * k)
    rf.rot(J["head"], -26 * k)
    for s in ("L", "R"):
        rf.rot(J["leg" + s], -50 * k)
        rf.rot(J["shin" + s], 84 * k)
    arms((-58 * k, -10, 0), (-58 * k, 10, 0), -24 * k, -24 * k)


ANIMS = [("walk", 4, walk), ("leap", 3, leap), ("slam", 3, slam)]
if PREVIEW:
    rf.preview(rf.TMP + "/tank_prev.png", J["root"], [lambda: walk(1, 4), lambda: leap(1, 3), lambda: leap(2, 3), lambda: slam(0, 3)], 320, 4.6, 1.2)
else:
    rf.sheet(rf.OUT + "/enemy_tank.png", J["root"], ANIMS, 320, 320, 4.6, 1.2)
rf.OUTLINE_W = 0.026
