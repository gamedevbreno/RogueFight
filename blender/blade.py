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
    coat=rf.toon("coat", "#16607a", "#0b3442", "#3aa3c4"),
    pants=rf.toon("pants", "#22364f", "#0e1a2a"),
    boot=rf.toon("boot", "#132436", "#070e16"),
    skin=rf.toon("skin", "#ffd9b8", "#e39a86", "#fff1e2"),
    hair=rf.toon("hair", "#eafcff", "#8fcbe6", "#eafcff"),
    cyan=rf.glow("cyan", "#39e6ff"),
    white=rf.glow("white", "#ffffff"),
    dark=rf.glow("dark", "#06222b"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.85))
rf.mk("pelvis", B().sphere((0, 0, 0), 0.17, (1.1, 0.85, 0.7)), M["pants"], J["hips"])
for s, sx in (("L", 1), ("R", -1)):
    j("leg" + s, "hips", (0.1 * sx, 0, -0.03))
    rf.mk("thigh" + s, B().cone((0, 0, 0.03), (0, 0, -0.38), 0.105, 0.085), M["pants"], J["leg" + s])
    j("shin" + s, "leg" + s, (0, 0, -0.38))
    rf.mk("boot" + s, B().cone((0, 0, 0.03), (0, 0, -0.32), 0.09, 0.075).sphere((0, -0.045, -0.36), 0.095, (1, 1.55, 0.75)),
          M["boot"], J["shin" + s])
    rf.mk("btrim" + s, B().cone((0, 0, -0.03), (0, 0, -0.07), 0.094, 0.094), M["cyan"], J["shin" + s], outline=0)

j("spine", "hips", (0, 0, 0.05))
rf.mk("torso", B().cone((0, 0, -0.04), (0, 0, 0.37), 0.165, 0.2, flat=(1, 0.8)).sphere((0, 0, 0.36), 0.2, (1.25, 0.78, 0.5)),
      M["coat"], J["spine"])
rf.mk("collar", B().cone((0, 0.02, 0.36), (0, 0.04, 0.47), 0.12, 0.16, flat=(1, 0.9)), M["coat"], J["spine"])
rf.mk("ftrim", B().box((0, -0.165, 0.17), (0.035, 0.03, 0.36)).box((0, -0.14, -0.01), (0.34, 0.06, 0.04)),
      M["cyan"], J["spine"], outline=0)

# cabeça
j("head", "spine", (0, 0, 0.47), rot0=(-20, 0, 0), scale=1.18)
rf.mk("face", B().sphere((0, 0, 0.2), 0.25, (1, 0.96, 1), seg=28), M["skin"], J["head"])
for sx in (1, -1):
    x = 0.1 * sx
    rf.mk("eyeW", B().sphere((x, -0.218, 0.18), 0.064, (0.82, 0.3, 1.18)), M["white"], J["head"], outline=0)
    rf.mk("eyeI", B().sphere((x, -0.236, 0.172), 0.048, (0.82, 0.3, 1.12)), M["cyan"], J["head"], outline=0)
    rf.mk("eyeP", B().sphere((x, -0.248, 0.168), 0.024, (0.8, 0.3, 1.25)).box((x, -0.232, 0.252), (0.125, 0.02, 0.024), rot=("Y", 8 * sx))
          .box((x * 1.05, -0.236, 0.3), (0.11, 0.02, 0.02), rot=("Y", -16 * sx)), M["dark"], J["head"], outline=0)
    rf.mk("eyeS", B().sphere((x + 0.022, -0.254, 0.2), 0.014), M["white"], J["head"], outline=0)
rf.mk("mouth", B().box((0, -0.243, 0.075), (0.05, 0.012, 0.012)), M["dark"], J["head"], outline=0)

hair = B().sphere((0, 0.035, 0.245), 0.262, (1.03, 1.0, 1.0), seg=24)
SPIKES = [
    ((0, 0.0, 0.44), (0.05, -0.04, 0.62), 0.11), ((0.15, 0.02, 0.4), (0.3, 0.0, 0.56), 0.1),
    ((-0.15, 0.02, 0.4), (-0.3, 0.02, 0.54), 0.1), ((0, 0.2, 0.36), (0, 0.44, 0.48), 0.12),
    ((0.16, 0.16, 0.3), (0.33, 0.34, 0.36), 0.11), ((-0.16, 0.16, 0.3), (-0.33, 0.34, 0.36), 0.11),
    ((0, 0.24, 0.2), (0, 0.46, 0.12), 0.11), ((0.2, 0.1, 0.14), (0.36, 0.2, 0.02), 0.09),
    ((-0.2, 0.1, 0.14), (-0.36, 0.2, 0.02), 0.09),
    ((0.0, -0.2, 0.41), (0.02, -0.265, 0.3), 0.075), ((0.12, -0.17, 0.4), (0.17, -0.24, 0.3), 0.07),
    ((-0.12, -0.17, 0.4), (-0.18, -0.23, 0.31), 0.07), ((0.24, -0.02, 0.3), (0.29, -0.06, 0.1), 0.06),
    ((-0.24, -0.02, 0.3), (-0.29, -0.06, 0.1), 0.06),
]
for p0, p1, r in SPIKES:
    hair.cone(p0, p1, r, 0, seg=10)
rf.mk("hair", hair, M["hair"], J["head"])

# braços
for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.27 * sx, 0, 0.36))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.27), 0.085, 0.07), M["coat"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.27))
    rf.mk("lower" + s, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.072, 0.064), M["coat"], J["fore" + s])
    rf.mk("cuff" + s, B().cone((0, 0, -0.17), (0, 0, -0.215), 0.07, 0.07), M["cyan"], J["fore" + s], outline=0)
    rf.mk("hand" + s, B().sphere((0, 0, -0.27), 0.068), M["skin"], J["fore" + s])

# sobretudo: abas traseiras (2 segmentos), abas laterais e cachecol neon
for s, sx in (("L", 1), ("R", -1)):
    j("tail" + s, "spine", (0.1 * sx, 0.13, 0.0))
    rf.mk("t1" + s, B().box((0, 0, -0.22), (0.21, 0.05, 0.48)), M["coat"], J["tail" + s], bevel=0.015)
    j("tail" + s + "2", "tail" + s, (0, 0, -0.44))
    rf.mk("t2" + s, B().box((0, 0, -0.17), (0.22, 0.045, 0.38)), M["coat"], J["tail" + s + "2"], bevel=0.015)
    rf.mk("t2t" + s, B().box((0, 0, -0.35), (0.225, 0.05, 0.035)), M["cyan"], J["tail" + s + "2"], outline=0)
    j("flap" + s, "spine", (0.175 * sx, -0.02, 0.0))
    rf.mk("f1" + s, B().box((0, 0, -0.2), (0.05, 0.27, 0.44)), M["coat"], J["flap" + s], bevel=0.015)
    rf.mk("f1t" + s, B().box((0, 0, -0.41), (0.055, 0.275, 0.035)), M["cyan"], J["flap" + s], outline=0)
j("scarf", "spine", (0.09, 0.15, 0.45))
rf.mk("sc1", B().box((0, 0, -0.14), (0.12, 0.035, 0.32)), M["cyan"], J["scarf"], bevel=0.01)
j("scarf2", "scarf", (0, 0, -0.29))
rf.mk("sc2", B().box((0, 0, -0.13), (0.11, 0.03, 0.3)), M["cyan"], J["scarf2"], bevel=0.01)


# ---------------------------------------------------------------- poses
def flutter(t, amp=1.0, back=0.0):
    for k, s in enumerate(("L", "R")):
        sx = 1 if s == "L" else -1
        ph = t * 2 * pi + k * 1.3
        rf.rot(J["tail" + s], back + 6 * amp * sin(ph), 0, 5 * amp * sin(ph + 1) * sx)
        rf.rot(J["tail" + s + "2"], back * 0.35 + 10 * amp * sin(ph - 1.1))
        rf.rot(J["flap" + s], back * 0.55 + 4 * amp * sin(ph + 0.5), -(5 + back * 0.12) * sx, 0)
    rf.rot(J["scarf"], 18 + back * 0.8 + 10 * amp * sin(t * 2 * pi + 2), 0, 10 * amp * sin(t * 2 * pi))
    rf.rot(J["scarf2"], 10 + back * 0.3 + 15 * amp * sin(t * 2 * pi + 0.8))


def idle(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["spine"], dz=0.012 * b)
    rf.rot(J["head"], -2 * b)
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["leg" + s], 0, -5 * sx, 0)
        rf.rot(J["arm" + s], 3 * b, -9 * sx, 0)
        rf.rot(J["fore" + s], -14)
    flutter(t, 0.7, 6)


def run(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=-0.035 + 0.05 * abs(cos(ph)))
    rf.rot(J["spine"], 17, 0, 9 * sin(ph))
    rf.rot(J["head"], -9, 0, -6 * sin(ph))
    for s, sx, p in (("L", 1, ph), ("R", -1, ph + pi)):
        rf.rot(J["leg" + s], -44 * sin(p))
        rf.rot(J["shin" + s], 12 + 58 * max(0, cos(p)))
        rf.rot(J["arm" + s], 40 * sin(p), -6 * sx, 0)
        rf.rot(J["fore" + s], -50)
    flutter(i / n, 1.2, 48)


def pose(hips=(0, 0), spine=(0, 0, 0), head=(0, 0, 0), legL=(0, 0), legR=(0, 0),
         armL=(0, 0), armR=(0, 0), fl=(0, 1, 0)):
    rf.move(J["hips"], dy=hips[0], dz=hips[1])
    rf.rot(J["spine"], *spine)
    rf.rot(J["head"], *head)
    for s, sx, leg, arm in (("L", 1, legL, armL), ("R", -1, legR, armR)):
        rf.rot(J["leg" + s], leg[0], -4 * sx, 0)
        rf.rot(J["shin" + s], leg[1])
        rf.rot(J["arm" + s], arm[0], -8 * sx, 0)
        rf.rot(J["fore" + s], arm[1])
    flutter(*fl)


def attack(i, n):
    [
        lambda: pose((0.02, -0.04), (-5, 0, 28), (0, 0, -18), (-16, 10), (16, 14), (-10, -30), (52, -75), (0, 0.5, 10)),
        lambda: pose((-0.08, -0.09), (18, 0, -34), (-10, 0, 22), (-38, 34), (30, 8), (42, -20), (-98, -6), (0.3, 1, 40)),
        lambda: pose((-0.1, -0.11), (23, 0, -52), (-12, 0, 34), (-40, 42), (34, 10), (50, -30), (-62, -18), (0.6, 1, 30)),
        lambda: pose((-0.03, -0.05), (9, 0, -16), (-4, 0, 10), (-16, 16), (12, 10), (14, -25), (-26, -34), (0.8, 0.6, 15)),
    ][i]()


def dash(i, n):
    [
        lambda: pose((0.04, -0.13), (-8, 0, 22), (4, 0, -16), (-26, 52), (10, 46), (-22, -30), (46, -92), (0, 0.4, -4)),
        lambda: pose((-0.1, -0.15), (38, 0, -22), (-26, 0, 16), (-58, 36), (56, 22), (62, -22), (-102, 0), (0.2, 1, 50)),
    ][i]()


ANIMS = [("idle", 4, idle), ("run", 6, run), ("attack", 4, attack), ("dash", 2, dash)]
POSES = [lambda: idle(0, 4), lambda: run(1, 6), lambda: attack(1, 4), lambda: dash(1, 2)]
if PREVIEW:
    rf.preview(rf.TMP + "/blade_prev.png", J["root"], POSES, 320, 2.6, 0.95)
else:
    rf.sheet(rf.OUT + "/player_blade.png", J["root"], ANIMS, 256, 256, 2.6, 0.95)
