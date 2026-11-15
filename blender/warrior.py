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
    armor=rf.toon("armor", "#4a4460", "#1c1828", "#746c90"),
    plate=rf.toon("plate", "#e0a020", "#8a5a0c", "#ffd870"),
    cape=rf.toon("cape", "#9a2c20", "#481210", "#c84a34"),
    skin=rf.toon("skin", "#ffdcc0", "#e09a86", "#fff1e2"),
    hair=rf.toon("hair", "#e8502c", "#8a2014", "#e8502c"),
    gold=rf.glow("gold", "#ffb830"),
    white=rf.glow("white", "#ffffff"),
    dark=rf.glow("dark", "#2a1608"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Valquíria de Ferro: guerreira de armadura pesada escura com detalhes dourados, capa curta
# e rabo de cavalo. Olha para -Y. O martelo é desenhado pelo jogo (hammer.py).
j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.84))
rf.mk("pelvis", B().sphere((0, 0, 0), 0.18, (1.15, 0.9, 0.7)), M["armor"], J["hips"])
for sx in (1, -1):   # tassets: placas da saia
    rf.mk("tasset", B().box((0.17 * sx, -0.03, -0.14), (0.16, 0.26, 0.3), rot=("Y", -10 * sx)), M["armor"], J["hips"], bevel=0.03)
    rf.mk("tassetT", B().box((0.19 * sx, -0.03, -0.28), (0.17, 0.27, 0.04), rot=("Y", -10 * sx)), M["gold"], J["hips"], outline=0)
for s, sx in (("L", 1), ("R", -1)):
    j("leg" + s, "hips", (0.11 * sx, 0, -0.03))
    rf.mk("thigh" + s, B().cone((0, 0, 0.03), (0, 0, -0.38), 0.11, 0.09), M["armor"], J["leg" + s])
    j("shin" + s, "leg" + s, (0, 0, -0.38))
    rf.mk("greave" + s, B().cone((0, 0, 0.04), (0, 0, -0.32), 0.105, 0.085).sphere((0, -0.045, -0.36), 0.1, (1, 1.55, 0.75)), M["armor"], J["shin" + s])
    rf.mk("knee" + s, B().sphere((0, -0.07, 0.0), 0.075, (1, 0.6, 1.1)), M["plate"], J["shin" + s])
    rf.mk("gtrim" + s, B().cone((0, 0, -0.26), (0, 0, -0.3), 0.092, 0.09), M["gold"], J["shin" + s], outline=0)

j("spine", "hips", (0, 0, 0.05))
rf.mk("torso", B().cone((0, 0, -0.04), (0, 0, 0.3), 0.15, 0.2, flat=(1, 0.8)).sphere((0, -0.01, 0.3), 0.21, (1.15, 0.9, 0.75)), M["armor"], J["spine"])
rf.mk("chest", B().sphere((0, -0.1, 0.3), 0.15, (1.3, 0.7, 0.9)), M["plate"], J["spine"])
rf.mk("gem", B().sphere((0, -0.2, 0.3), 0.05, (1, 0.6, 1)), M["gold"], J["spine"], outline=0.014)
rf.mk("belt", B().cone((0, 0, -0.03), (0, 0, 0.03), 0.17, 0.16, flat=(1, 0.85)), M["gold"], J["spine"], outline=0)
rf.mk("gorget", B().cone((0, 0.01, 0.4), (0, 0.02, 0.47), 0.13, 0.15, flat=(1, 0.9)), M["plate"], J["spine"])

# capa curta: dois painéis nas costas
for s, sx in (("L", 1), ("R", -1)):
    j("cape" + s, "spine", (0.1 * sx, 0.17, 0.4))
    rf.mk("cape" + s, B().box((0, 0, -0.26), (0.24, 0.045, 0.56)), M["cape"], J["cape" + s], bevel=0.015)
    rf.mk("capeT" + s, B().box((0, 0, -0.53), (0.245, 0.05, 0.035)), M["gold"], J["cape" + s], outline=0)

# cabeça
j("head", "spine", (0, 0, 0.47), rot0=(-20, 0, 0), scale=1.18)
rf.mk("face", B().sphere((0, 0, 0.2), 0.245, (1, 0.96, 1), seg=28), M["skin"], J["head"])
for sx in (1, -1):
    x = 0.098 * sx
    rf.mk("eyeW", B().sphere((x, -0.214, 0.17), 0.068, (0.85, 0.3, 1.18)), M["white"], J["head"], outline=0)
    rf.mk("eyeI", B().sphere((x, -0.232, 0.162), 0.052, (0.85, 0.3, 1.1)), M["gold"], J["head"], outline=0)
    rf.mk("eyeP", B().sphere((x, -0.245, 0.158), 0.024, (0.8, 0.3, 1.3)).box((x, -0.228, 0.248), (0.135, 0.02, 0.026), rot=("Y", 10 * sx))
          .box((x * 1.05, -0.234, 0.295), (0.11, 0.02, 0.02), rot=("Y", -14 * sx)), M["dark"], J["head"], outline=0)
    rf.mk("eyeS", B().sphere((x + 0.024, -0.252, 0.195), 0.016), M["white"], J["head"], outline=0)
rf.mk("mouth", B().box((0, -0.238, 0.07), (0.045, 0.012, 0.012)), M["dark"], J["head"], outline=0)
hair = B().sphere((0, 0.035, 0.24), 0.262, (1.04, 1.0, 1.0), seg=24)
for p0, p1, r in [
    ((0.0, -0.2, 0.4), (0.05, -0.265, 0.29), 0.085), ((0.13, -0.17, 0.39), (0.2, -0.24, 0.27), 0.075),
    ((-0.13, -0.17, 0.39), (-0.19, -0.23, 0.3), 0.075),
    ((0.25, -0.03, 0.26), (0.28, -0.09, 0.02), 0.07), ((-0.25, -0.03, 0.26), (-0.28, -0.09, 0.02), 0.07),
]:
    hair.cone(p0, p1, r, 0.012, seg=10)
rf.mk("hair", hair, M["hair"], J["head"])
rf.mk("tiara", B().torus(0.255, 0.028, seg=28, c=(0, 0.03, 0.37)), M["gold"], J["head"], outline=0)
rf.mk("tiaraW", B().cone((0.2, -0.1, 0.38), (0.36, 0.02, 0.56), 0.05, 0, seg=6, flat=(1, 0.4)).cone((-0.2, -0.1, 0.38), (-0.36, 0.02, 0.56), 0.05, 0, seg=6, flat=(1, 0.4)),
      M["plate"], J["head"])
# rabo de cavalo alto, em 3 segmentos
j("pony", "head", (0, 0.24, 0.36), rot0=(100, 0, 0))
rf.mk("p1", B().sphere((0, 0, 0), 0.09).cone((0, 0, 0), (0, 0.02, -0.2), 0.09, 0.08), M["hair"], J["pony"])
j("pony2", "pony", (0, 0.02, -0.2), rot0=(-30, 0, 0))
rf.mk("p2", B().cone((0, 0, 0.03), (0, 0.0, -0.2), 0.08, 0.065).sphere((0, 0, 0), 0.08), M["hair"], J["pony2"])
j("pony3", "pony2", (0, 0, -0.2), rot0=(-25, 0, 0))
rf.mk("p3", B().cone((0, 0, 0.03), (0, 0, -0.24), 0.065, 0, seg=10), M["hair"], J["pony3"])

# braços com ombreiras e manoplas
for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.28 * sx, 0, 0.36))
    rf.mk("pad" + s, B().sphere((0.03 * sx, 0, 0.04), 0.16, (1.2, 1.05, 0.85)), M["plate"], J["arm" + s])
    rf.mk("upper" + s, B().cone((0, 0, 0.0), (0, 0, -0.27), 0.08, 0.07), M["armor"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.27))
    rf.mk("gaunt" + s, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.075, 0.095), M["armor"], J["fore" + s])
    rf.mk("cuff" + s, B().cone((0, 0, -0.16), (0, 0, -0.2), 0.096, 0.1), M["gold"], J["fore" + s], outline=0)
    rf.mk("hand" + s, B().sphere((0, 0, -0.27), 0.072), M["armor"], J["fore" + s])


# ---------------------------------------------------------------- poses
def flow(t, amp=1.0, back=0.0):
    for k, s in enumerate(("L", "R")):
        sx = 1 if s == "L" else -1
        ph = 2 * pi * t + k * 1.3
        rf.rot(J["cape" + s], back + 6 * amp * sin(ph), 0, 5 * amp * sin(ph + 1) * sx)
    rf.rot(J["pony"], back * 0.15 + 6 * amp * sin(2 * pi * t + 0.5), 0, 8 * amp * sin(2 * pi * t))
    rf.rot(J["pony2"], back * 0.3 + 10 * amp * sin(2 * pi * t - 0.6), 0, 10 * amp * sin(2 * pi * t - 0.4))
    rf.rot(J["pony3"], back * 0.3 + 14 * amp * sin(2 * pi * t - 1.6), 0, 12 * amp * sin(2 * pi * t - 1.2))


def pose(hips=(0, 0), spine=(0, 0, 0), head=(0, 0, 0), legL=(0, 0), legR=(0, 0),
         armL=(0, 0, 0), armR=(0, 0, 0), fl=(0, 1, 0)):
    rf.move(J["hips"], dy=hips[0], dz=hips[1])
    rf.rot(J["spine"], *spine)
    rf.rot(J["head"], *head)
    for s, sx, leg, arm in (("L", 1, legL, armL), ("R", -1, legR, armR)):
        rf.rot(J["leg" + s], leg[0], -5 * sx, 0)
        rf.rot(J["shin" + s], leg[1])
        rf.rot(J["arm" + s], arm[0], -8 * sx + arm[2], 0)
        rf.rot(J["fore" + s], arm[1])
    flow(*fl)


def idle(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["spine"], dz=0.012 * b)
    pose(legL=(0, 0), legR=(0, 0), head=(-2 * b, 0, 0), armL=(4 * b, -16, 0), armR=(-24, -40, 0), fl=(t, 0.7, 6))


def run(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=-0.035 + 0.05 * abs(cos(ph)))
    rf.rot(J["spine"], 16, 0, 8 * sin(ph))
    rf.rot(J["head"], -8, 0, -5 * sin(ph))
    for s, sx, p in (("L", 1, ph), ("R", -1, ph + pi)):
        rf.rot(J["leg" + s], -42 * sin(p), -5 * sx, 0)
        rf.rot(J["shin" + s], 12 + 56 * max(0, cos(p)))
        rf.rot(J["arm" + s], 34 * sin(p), -8 * sx, 0)
        rf.rot(J["fore" + s], -50)
    flow(i / n, 1.2, 46)


def attack(i, n):
    # golpe de martelo com as duas mãos: ergue, desce, acompanha, recupera
    [
        lambda: pose((0.03, -0.03), (-12, 0, 30), (4, 0, -18), (-14, 10), (18, 14), (-150, -30, 20), (-160, -30, -20), (0, 0.5, -6)),
        lambda: pose((-0.06, -0.1), (22, 0, -30), (-10, 0, 20), (-38, 36), (30, 10), (-80, -14, 24), (-88, -10, -24), (0.3, 1, 36)),
        lambda: pose((-0.08, -0.14), (30, 0, -44), (-12, 0, 30), (-42, 44), (34, 12), (-52, -20, 20), (-58, -16, -20), (0.6, 1, 28)),
        lambda: pose((-0.02, -0.05), (10, 0, -14), (-4, 0, 8), (-16, 16), (12, 10), (-20, -30, 0), (-30, -36, 0), (0.8, 0.6, 12)),
    ][i]()


def dash(i, n):
    # investida de ombro (também usada no ar durante o Salto Sísmico)
    [
        lambda: pose((-0.04, -0.1), (30, 0, -40), (-18, 0, 30), (-40, 44), (34, 30), (30, -70, 0), (-40, -100, 30), (0.1, 0.8, 50)),
        lambda: pose((-0.1, -0.14), (40, 0, -52), (-24, 0, 38), (-58, 30), (54, 22), (50, -60, 0), (-30, -110, 40), (0.3, 1, 72)),
    ][i]()


ANIMS = [("idle", 4, idle), ("run", 6, run), ("attack", 4, attack), ("dash", 2, dash)]
POSES = [lambda: idle(0, 4), lambda: run(1, 6), lambda: attack(0, 4), lambda: attack(1, 4), lambda: dash(1, 2)]
if PREVIEW:
    rf.preview(rf.TMP + "/warrior_prev.png", J["root"], POSES, 320, 2.9, 1.0)
else:
    rf.sheet(rf.OUT + "/player_warrior.png", J["root"], ANIMS, 256, 256, 2.9, 1.0)
