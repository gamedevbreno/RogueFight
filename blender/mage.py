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
    robe=rf.toon("robe", "#5a2fb0", "#2d1458", "#8455e0"),
    lilac=rf.toon("lilac", "#c78bff", "#8a55d6", "#ecd6ff"),
    skin=rf.toon("skin", "#ffe0cc", "#e6a093", "#fff3ea"),
    hair=rf.toon("hair", "#ffd6f3", "#d58ad0", "#ffd6f3"),
    boot=rf.toon("boot", "#2d1458", "#160a2e"),
    gold=rf.glow("gold", "#ffe14a"),
    eye=rf.glow("eye", "#ff7ae6"),
    white=rf.glow("white", "#ffffff"),
    dark=rf.glow("dark", "#1c0b38"),
    spark=rf.glow("spark", "#f3e6ff"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.82))
# saia longa do manto + barra lilás
j("skirt", "hips", (0, 0, 0))
rf.mk("skirt", B().cone((0, 0, 0.04), (0, 0, -0.7), 0.15, 0.43, seg=20), M["robe"], J["skirt"])
rf.mk("hem", B().cone((0, 0, -0.62), (0, 0, -0.72), 0.4, 0.45, seg=20), M["lilac"], J["skirt"])
rf.mk("panel", B().box((0, -0.3, -0.33), (0.1, 0.03, 0.56), rot=("X", -22)), M["lilac"], J["skirt"], outline=0)
for s, sx in (("L", 1), ("R", -1)):
    j("foot" + s, "hips", (0.11 * sx, 0, -0.1))
    rf.mk("foot" + s, B().cone((0, 0, 0), (0, 0, -0.62), 0.06, 0.05).sphere((0, -0.04, -0.66), 0.08, (1, 1.5, 0.75)),
          M["boot"], J["foot" + s])

j("spine", "hips", (0, 0, 0.03))
rf.mk("torso", B().cone((0, 0, -0.03), (0, 0, 0.36), 0.125, 0.16, flat=(1, 0.8)), M["robe"], J["spine"])
rf.mk("belt", B().cone((0, 0, -0.02), (0, 0, 0.04), 0.15, 0.14, flat=(1, 0.85)), M["lilac"], J["spine"], outline=0)
rf.mk("capelet", B().cone((0, 0, 0.43), (0, 0.01, 0.2), 0.1, 0.31, seg=20, flat=(1, 0.85)), M["lilac"], J["spine"])
rf.mk("brooch", B().sphere((0, -0.2, 0.33), 0.05, (1, 0.6, 1)), M["gold"], J["spine"], outline=0.015)

# cabeça
j("head", "spine", (0, 0, 0.44), rot0=(-20, 0, 0), scale=1.18)
rf.mk("face", B().sphere((0, 0, 0.2), 0.245, (1, 0.96, 1), seg=28), M["skin"], J["head"])
for sx in (1, -1):
    x = 0.098 * sx
    rf.mk("eyeW", B().sphere((x, -0.214, 0.17), 0.07, (0.85, 0.3, 1.2)), M["white"], J["head"], outline=0)
    rf.mk("eyeI", B().sphere((x, -0.232, 0.162), 0.055, (0.85, 0.3, 1.12)), M["eye"], J["head"], outline=0)
    rf.mk("eyeP", B().sphere((x, -0.245, 0.158), 0.024, (0.8, 0.3, 1.3)).box((x, -0.228, 0.25), (0.14, 0.02, 0.026), rot=("Y", 10 * sx))
          .box((x * 1.75, -0.2, 0.235), (0.05, 0.02, 0.02), rot=("Y", 40 * sx)), M["dark"], J["head"], outline=0)
    rf.mk("eyeS", B().sphere((x + 0.024, -0.252, 0.195), 0.017), M["white"], J["head"], outline=0)
rf.mk("mouth", B().box((0, -0.238, 0.07), (0.04, 0.012, 0.012)), M["dark"], J["head"], outline=0)

hair = B().sphere((0, 0.035, 0.24), 0.262, (1.04, 1.0, 1.0), seg=24)
for p0, p1, r in [
    ((0.0, -0.2, 0.4), (-0.03, -0.265, 0.29), 0.085), ((0.13, -0.17, 0.39), (0.18, -0.24, 0.29), 0.075),
    ((-0.13, -0.17, 0.39), (-0.2, -0.22, 0.3), 0.075),
    ((0.25, -0.03, 0.26), (0.28, -0.1, -0.22), 0.075), ((-0.25, -0.03, 0.26), (-0.28, -0.1, -0.22), 0.075),
]:
    hair.cone(p0, p1, r, 0.012, seg=10)
rf.mk("hair", hair, M["hair"], J["head"])
# cabelo longo: 3 segmentos encadeados que balançam
j("hair1", "head", (0, 0.17, 0.2))
rf.mk("h1", B().sphere((0, 0.03, -0.14), 0.24, (1.0, 0.6, 1.1)), M["hair"], J["hair1"])
j("hair2", "hair1", (0, 0.04, -0.3))
rf.mk("h2", B().sphere((0, 0.01, -0.16), 0.22, (0.95, 0.5, 1.15)), M["hair"], J["hair2"])
j("hair3", "hair2", (0, 0.0, -0.32))
rf.mk("h3", B().cone((0, 0, 0.05), (0, 0.02, -0.34), 0.17, 0.02, seg=12, flat=(1, 0.5)), M["hair"], J["hair3"])

# chapéu de maga: aba larga, copa e ponta dobrada
j("hat", "head", (0, 0.02, 0.4), rot0=(-10, 0, 6))
rf.mk("brim", B().cone((0, 0, -0.01), (0, 0, 0.035), 0.5, 0.46, seg=28), M["robe"], J["hat"])
rf.mk("crown", B().cone((0, 0, 0.02), (0, 0.06, 0.36), 0.25, 0.12, seg=18), M["robe"], J["hat"])
rf.mk("band", B().cone((0, 0, 0.035), (0, 0.012, 0.1), 0.255, 0.232, seg=18), M["lilac"], J["hat"], outline=0)
rf.mk("gem", B().sphere((0, -0.245, 0.07), 0.05, (1, 0.6, 1)), M["gold"], J["hat"], outline=0.015)
j("tip", "hat", (0, 0.06, 0.34))
rf.mk("tip", B().cone((0, 0, -0.02), (0.06, 0.2, 0.2), 0.125, 0.06, seg=14).cone((0.06, 0.2, 0.2), (0.14, 0.4, 0.14), 0.062, 0, seg=14)
      .sphere((0.06, 0.2, 0.2), 0.062), M["robe"], J["tip"])

# braços com mangas em sino
for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.2 * sx, 0, 0.34))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.25), 0.07, 0.07), M["robe"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.25))
    rf.mk("lower" + s, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.07, 0.115), M["robe"], J["fore" + s])
    rf.mk("cuff" + s, B().cone((0, 0, -0.19), (0, 0, -0.225), 0.112, 0.122), M["lilac"], J["fore" + s], outline=0)
    rf.mk("hand" + s, B().sphere((0, 0, -0.26), 0.058), M["skin"], J["fore" + s])
j("orb", "foreR", (0, 0, -0.38))
rf.mk("orb", B().sphere((0, 0, 0), 0.1), M["spark"], J["orb"], outline=0.02)


# ---------------------------------------------------------------- poses
def hairsway(t, amp=1.0, back=0.0):
    ph = 2 * pi * t
    rf.rot(J["hair1"], back + 4 * amp * sin(ph), 0, 5 * amp * sin(ph + 1))
    rf.rot(J["hair2"], back * 0.5 + 7 * amp * sin(ph - 0.9), 0, 6 * amp * sin(ph + 0.2))
    rf.rot(J["hair3"], back * 0.4 + 10 * amp * sin(ph - 1.8), 0, 8 * amp * sin(ph - 0.6))
    rf.rot(J["tip"], 8 * amp * sin(ph + 0.6), 0, 6 * amp * sin(ph))


def idle(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["spine"], dz=0.012 * b)
    rf.rot(J["head"], -2 * b)
    J["orb"].scale = (0, 0, 0)
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["arm" + s], 3 * b, -14 * sx, 0)
        rf.rot(J["fore" + s], -22, 10 * sx, 0)
    hairsway(t, 0.8, 4)


def run(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=-0.02 + 0.045 * abs(cos(ph)))
    rf.rot(J["spine"], 14, 0, 7 * sin(ph))
    rf.rot(J["head"], -8, 0, -5 * sin(ph))
    rf.rot(J["skirt"], 10 + 5 * cos(2 * ph), 0, 5 * sin(ph))
    J["orb"].scale = (0, 0, 0)
    for s, sx, p in (("L", 1, ph), ("R", -1, ph + pi)):
        rf.rot(J["foot" + s], -34 * sin(p))
        rf.rot(J["arm" + s], 34 * sin(p), -12 * sx, 0)
        rf.rot(J["fore" + s], -40)
    hairsway(i / n, 1.2, 40)


def cast(i, n):
    k = [0.45, 1.0, 0.7][i]
    rf.move(J["hips"], dy=0.02 * k, dz=-0.03 * k)
    rf.rot(J["spine"], -6 * k, 0, -24 * k)
    rf.rot(J["head"], 2, 0, 16 * k)
    rf.rot(J["skirt"], -6 * k, 0, 0)
    rf.rot(J["armR"], -88 * k, 6, 0)
    rf.rot(J["foreR"], -12, 0, 0)
    rf.rot(J["armL"], 30 * k, -24, 0)
    rf.rot(J["foreL"], -30)
    rf.rot(J["footL"], -14 * k)
    rf.rot(J["footR"], 12 * k)
    s = [0.6, 1.25, 0.9][i]
    J["orb"].scale = (s, s, s)
    hairsway(i / n, 1.0, [8, 26, 16][i])


ANIMS = [("idle", 4, idle), ("run", 6, run), ("cast", 3, cast)]
if PREVIEW:
    rf.preview(rf.TMP + "/mage_prev.png", J["root"], [lambda: idle(0, 4), lambda: run(1, 6), lambda: run(4, 6), lambda: cast(1, 3)], 320, 3.2, 1.15)
else:
    rf.sheet(rf.OUT + "/player_mage.png", J["root"], ANIMS, 256, 256, 3.2, 1.15)
