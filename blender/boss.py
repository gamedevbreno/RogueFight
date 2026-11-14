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
from mathutils import Vector
B = rf.B

rf.reset()
rf.OUTLINE_W = 0.04
M = dict(
    armor=rf.toon("armor", "#8a1a3c", "#3d0a22", "#d4365e"),
    dark=rf.toon("dark", "#3a1436", "#170818", "#5c2456"),
    wing=rf.toon("wing", "#7a1c5c", "#3a0c30", "#a8347e"),
    bone=rf.toon("bone", "#f6e6d0", "#b89878", "#ffffff"),
    fire=rf.glow("fire", "#ff3b4e"),
    black=rf.glow("black", "#12040e"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Arconte Abissal: lorde demônio flutuante, alado, com chifres, halo e glaive. Olha para -Y.
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 1.55))

# manto inferior que afina em fiapos (no lugar das pernas)
j("robe", "body", (0, 0, 0.1))
rf.mk("robe", B().cone((0, 0, 0.1), (0, 0.05, -0.7), 0.5, 0.34, seg=16), M["dark"], J["robe"])
rf.mk("belt", B().torus(0.5, 0.04, seg=28, c=(0, 0, 0.08)), M["fire"], J["robe"], outline=0)
j("robe2", "robe", (0, 0.05, -0.7))
rf.mk("robe2", B().cone((0, 0, 0.05), (0, 0.12, -0.75), 0.34, 0.05, seg=14)
      .cone((0.2, 0, 0), (0.34, 0.1, -0.5), 0.14, 0, seg=8).cone((-0.2, 0, 0), (-0.34, 0.1, -0.5), 0.14, 0, seg=8)
      .cone((0, -0.15, 0), (0, -0.22, -0.45), 0.14, 0, seg=8), M["dark"], J["robe2"])

j("spine", "body", (0, 0, 0.15))
rf.mk("abdomen", B().cone((0, 0, -0.1), (0, 0, 0.3), 0.42, 0.5, seg=16), M["dark"], J["spine"])
rf.mk("torso", B().sphere((0, 0, 0.5), 0.6, (1.12, 0.8, 1.0), seg=28), M["armor"], J["spine"])
rf.mk("plate", B().box((0, -0.44, 0.58), (0.7, 0.12, 0.5), rot=("X", -8)), M["dark"], J["spine"], bevel=0.06)
rf.mk("ribs", B().box((0.24, -0.47, 0.3), (0.22, 0.04, 0.05), rot=("Y", 22)).box((-0.24, -0.47, 0.3), (0.22, 0.04, 0.05), rot=("Y", -22)),
      M["fire"], J["spine"], outline=0)
j("core", "spine", (0, -0.52, 0.6))
rf.mk("core", B().sphere((0, 0, 0), 0.15, (1, 0.5, 1)), M["fire"], J["core"], outline=0.02)

# cabeça: elmo, olhos em brasa, chifres curvos, coroa e halo
j("head", "spine", (0, -0.1, 1.22), rot0=(-14, 0, 0))
rf.mk("helm", B().sphere((0, 0, 0.08), 0.3, (1, 1.05, 1.0), seg=22).box((0, -0.2, -0.1), (0.3, 0.2, 0.2)), M["dark"], J["head"])
rf.mk("eyes", B().box((0.11, -0.29, 0.1), (0.13, 0.04, 0.05), rot=("Y", 18)).box((-0.11, -0.29, 0.1), (0.13, 0.04, 0.05), rot=("Y", -18)),
      M["fire"], J["head"], outline=0)
horn = B()
for sx in (1, -1):
    horn.cone((0.2 * sx, 0.02, 0.25), (0.55 * sx, 0.1, 0.5), 0.12, 0.09, seg=10).sphere((0.55 * sx, 0.1, 0.5), 0.09)
    horn.cone((0.55 * sx, 0.1, 0.5), (0.72 * sx, 0.0, 0.95), 0.09, 0.05, seg=10).sphere((0.72 * sx, 0.0, 0.95), 0.05)
    horn.cone((0.72 * sx, 0.0, 0.95), (0.5 * sx, -0.15, 1.3), 0.05, 0, seg=10)
    horn.cone((0.12 * sx, 0.1, 0.3), (0.2 * sx, 0.2, 0.62), 0.07, 0, seg=8)
horn.cone((0, -0.05, 0.33), (0, -0.12, 0.75), 0.08, 0, seg=8)
rf.mk("horns", horn, M["bone"], J["head"])
j("halo", "head", (0, 0.3, 0.45), rot0=(76, 0, 0))
rf.mk("halo", B().torus(0.66, 0.035, seg=40), M["fire"], J["halo"], outline=0)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.85 * sx, 0, 0.92))
    rf.mk("pad" + s, B().sphere((0.05 * sx, 0, 0.08), 0.4, (1.1, 1, 0.8), seg=20), M["armor"], J["arm" + s])
    rf.mk("pspk" + s, B().cone((0.1 * sx, 0, 0.3), (0.36 * sx, 0, 0.66), 0.12, 0, seg=8),
          M["bone"], J["arm" + s])
    rf.mk("upper" + s, B().cone((0.03 * sx, 0, -0.1), (0.03 * sx, 0, -0.6), 0.17, 0.15, seg=12), M["dark"], J["arm" + s])
    j("fore" + s, "arm" + s, (0.03 * sx, 0, -0.6))
    rf.mk("gaunt" + s, B().cone((0, 0, 0.05), (0, 0, -0.5), 0.19, 0.24, seg=12), M["armor"], J["fore" + s])
    rf.mk("hand" + s, B().sphere((0, 0, -0.62), 0.2), M["dark"], J["fore" + s])
    cl = B()
    for kx in (-0.11, 0, 0.11):
        cl.cone((kx, -0.1, -0.72), (kx * 1.3, -0.2, -1.0), 0.045, 0, seg=6)
    rf.mk("claw" + s, cl, M["bone"], J["fore" + s], outline=0.02)

# glaive na mão direita (eixo local +Z = ponta da lâmina)
j("weapon", "foreR", (0, 0, -0.62))
rf.mk("shaft", B().cone((0, 0, -0.5), (0, 0, 1.15), 0.06, 0.06, seg=8).cone((0, 0, -0.5), (0, 0, -0.72), 0.085, 0, seg=8), M["dark"], J["weapon"])
rf.mk("edge", B().cone((0, 0, 1.05), (0, 0, 1.98), 0.42, 0, seg=4, flat=(1, 0.14)), M["fire"], J["weapon"], outline=0.03, smooth=False)
rf.mk("bcore", B().cone((0, 0, 1.08), (0, 0, 1.72), 0.22, 0, seg=4, flat=(1, 0.36)), M["black"], J["weapon"], outline=0, smooth=False)
rf.mk("guard", B().box((0, 0, 1.05), (0.76, 0.16, 0.13)), M["bone"], J["weapon"], bevel=0.03)

# asas: braço + 3 dedos com membranas
for s, sx in (("L", 1), ("R", -1)):
    T1 = Vector((1.05 * sx, 0.1, 0.65))
    F = [Vector((0.95 * sx, 0.05, 0.28)), Vector((0.82 * sx, 0.1, -0.62)), Vector((0.22 * sx, 0.12, -0.98))]
    j("wing" + s, "spine", (0.35 * sx, 0.38, 0.9))
    rf.mk("wb" + s, B().cone((0, 0, 0), T1, 0.085, 0.06, seg=10).cone(T1, T1 + Vector((0.08 * sx, 0, 0.24)), 0.06, 0, seg=8), M["dark"], J["wing" + s])
    rf.mk("wm" + s, B().tri((0, 0, 0), T1, T1 + F[2]).tri((0, 0, 0), T1 + F[2], (0.12 * sx, 0.1, -0.8)), M["wing"], J["wing" + s], smooth=False, outline=0.025)
    j("wing" + s + "2", "wing" + s, T1)
    fg = B()
    for f in F:
        fg.cone((0, 0, 0), f, 0.04, 0.012, seg=6)
    rf.mk("wf" + s, fg, M["dark"], J["wing" + s + "2"], outline=0.02)
    rf.mk("wn" + s, B().tri((0, 0, 0), F[0], F[1]).tri((0, 0, 0), F[1], F[2]), M["wing"], J["wing" + s + "2"], smooth=False, outline=0.025)


# ---------------------------------------------------------------- poses
def wings(flap=0.0, fold=0.0):
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["wing" + s], 0, -flap * sx, fold * sx)
        rf.rot(J["wing" + s + "2"], 0, -flap * 0.6 * sx, fold * 0.5 * sx)


def robe(t, back=0.0):
    rf.rot(J["robe"], back + 4 * sin(2 * pi * t), 0, 4 * sin(2 * pi * t + 1))
    rf.rot(J["robe2"], back * 0.8 + 8 * sin(2 * pi * t - 1), 0, 6 * sin(2 * pi * t))


def arm(s, a=(0, 0, 0), fore=0.0):
    rf.rot(J["arm" + s], *a)
    rf.rot(J["fore" + s], fore)


def glaive(total, arm_x, fore_x):
    """Aponta a glaive: `total` é o ângulo final no plano YZ (0 = para cima, 90 = para frente)."""
    rf.rot(J["weapon"], total - arm_x - fore_x)


def core(k):
    J["core"].scale = (k, k, k)


def walk(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["body"], dz=0.08 * b)
    rf.rot(J["spine"], 4)
    wings(12 + 14 * b, 8)
    robe(t, 10)
    arm("L", (8, -12, 0), -25)
    arm("R", (-20, 10, 0), -30)
    glaive(10, -20, -30)
    core(1 + 0.12 * b)


def slash(i, n):
    if i == 0:
        rf.move(J["body"], dz=0.1)
        rf.rot(J["spine"], -8, 0, 35); rf.rot(J["head"], 0, 0, -20)
        arm("R", (70, 10, 0), -40); glaive(-35, 70, -40)
        arm("L", (-30, -20, 0), -40); wings(30, -5); robe(0, 0)
    elif i == 1:
        rf.move(J["body"], dz=0.16)
        rf.rot(J["spine"], -12, 0, 48); rf.rot(J["head"], 0, 0, -28)
        arm("R", (95, 10, 0), -40); glaive(-50, 95, -40)
        arm("L", (-40, -24, 0), -40); wings(42, -8); robe(0.2, -6)
    elif i == 2:
        rf.move(J["body"], dy=-0.25, dz=-0.15)
        rf.rot(J["spine"], 22, 0, -40); rf.rot(J["head"], -6, 0, 24)
        arm("R", (-75, 0, 0), -10); glaive(105, -75, -10)
        arm("L", (40, -20, 0), -30); wings(-10, 25); robe(0.4, 30)
    else:
        rf.move(J["body"], dy=-0.2, dz=-0.2)
        rf.rot(J["spine"], 26, 0, -58); rf.rot(J["head"], -6, 0, 34)
        arm("R", (-50, 0, 0), -20); glaive(125, -50, -20)
        arm("L", (46, -20, 0), -30); wings(0, 20); robe(0.6, 22)
    core(1)


def cast(i, n):
    if i < 2:
        k = (0.55, 1.0)[i]
        rf.move(J["body"], dz=0.15 * k)
        rf.rot(J["spine"], -10 * k); rf.rot(J["head"], -10 * k)
        arm("L", (0, -112 * k, 0), -20); arm("R", (0, 112 * k, 0), -20)
        rf.rot(J["weapon"], 0)
        wings(45 * k, -10); robe(0.3 * i, -8 * k); core(1 + 0.9 * k)
    else:
        rf.move(J["body"], dy=-0.1)
        rf.rot(J["spine"], 18); rf.rot(J["head"], -8)
        arm("L", (-82, -20, 0), -10); arm("R", (-82, 20, 0), -10)
        glaive(80, -82, -10)
        wings(-5, 30); robe(0.7, 24); core(2.1)


def slam(i, n):
    if i == 0:      # agacha
        rf.move(J["body"], dz=-0.45)
        rf.rot(J["spine"], 24); rf.rot(J["head"], -14)
        arm("L", (30, -14, 0), -70); arm("R", (30, 14, 0), -70); glaive(20, 30, -70)
        wings(-25, 30); robe(0, 20)
    elif i == 1:    # no ar: asas abertas, glaive sobre a cabeça
        rf.move(J["body"], dz=0.2)
        rf.rot(J["spine"], -16); rf.rot(J["head"], 14)
        arm("L", (-150, -16, 0), -10); arm("R", (-170, 10, 0), -10); glaive(-75, -170, -10)
        wings(60, -10); robe(0.3, -14)
    elif i == 2:    # impacto
        rf.move(J["body"], dy=-0.1, dz=-0.6)
        rf.rot(J["spine"], 40); rf.rot(J["head"], -25)
        arm("L", (-60, -14, 0), -30); arm("R", (-70, 8, 0), -20); glaive(84, -70, -20)
        wings(-30, 35); robe(0.5, 30)
    else:           # recuperação
        rf.move(J["body"], dz=-0.3)
        rf.rot(J["spine"], 20); rf.rot(J["head"], -12)
        arm("L", (-20, -14, 0), -30); arm("R", (-40, 8, 0), -30); glaive(60, -40, -30)
        wings(0, 20); robe(0.7, 16)
    core(1.4 if i == 2 else 1)


ANIMS = [("walk", 4, walk), ("slash", 4, slash), ("cast", 3, cast), ("slam", 4, slam)]
if PREVIEW:
    rf.preview(rf.TMP + "/boss_prev.png", J["root"], [lambda: walk(0, 4), lambda: slash(1, 4), lambda: slash(2, 4), lambda: cast(1, 3), lambda: slam(1, 4), lambda: slam(2, 4)], 320, 7.8, 1.9)
else:
    rf.sheet(rf.OUT + "/enemy_boss.png", J["root"], ANIMS, 384, 384, 7.8, 1.9)
rf.OUTLINE_W = 0.026
