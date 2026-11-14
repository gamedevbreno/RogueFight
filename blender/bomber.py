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
    cloak=rf.toon("cloak", "#1f6a58", "#0c2e28", "#3aa588"),
    iron=rf.toon("iron", "#3c3c58", "#18182a", "#62628a"),
    bone=rf.toon("bone", "#f2ecd8", "#b8a888", "#ffffff"),
    leather=rf.toon("leather", "#7a5230", "#3c2614", "#a47444"),
    tox=rf.glow("tox", "#2effb0"),
    void=rf.glow("void", "#04120e"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Alquimista Volátil: baixinho encapuzado, máscara de bico, caldeirão borbulhante nas costas.
j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.5))
for s, sx in (("L", 1), ("R", -1)):
    j("foot" + s, "hips", (0.13 * sx, 0, -0.1))
    rf.mk("foot" + s, B().cone((0, 0, 0), (0, 0, -0.3), 0.07, 0.06).sphere((0, -0.05, -0.34), 0.09, (1, 1.5, 0.7)), M["leather"], J["foot" + s])
rf.mk("robe", B().cone((0, 0, 0.2), (0, 0, -0.32), 0.22, 0.38, seg=16), M["cloak"], J["hips"])

j("spine", "hips", (0, 0, 0.15), rot0=(14, 0, 0))
rf.mk("torso", B().sphere((0, 0, 0.22), 0.3, (1, 0.9, 1)), M["cloak"], J["spine"])
vials = B()
for x in (-0.15, 0, 0.15):
    vials.cone((x, -0.29, 0.06), (x, -0.31, -0.1), 0.045, 0.035, seg=8)
rf.mk("vials", vials, M["tox"], J["spine"], outline=0.014)
rf.mk("belt", B().torus(0.29, 0.035, seg=24, c=(0, 0, 0.07)), M["leather"], J["spine"], outline=0)

# caldeirão nas costas, com líquido tóxico, bolhas e dois frascos laterais
j("pack", "spine", (0, 0.36, 0.32))
rf.mk("cauldron", B().sphere((0, 0, 0), 0.36, (1, 1, 0.9), seg=22).torus(0.3, 0.055, seg=24, c=(0, 0, 0.22)), M["iron"], J["pack"])
rf.mk("liquid", B().sphere((0, 0, 0.21), 0.27, (1, 1, 0.25)), M["tox"], J["pack"], outline=0)
j("bub", "pack", (0, 0, 0.3))
rf.mk("bub", B().sphere((0.1, 0.05, 0.03), 0.075).sphere((-0.09, -0.06, 0.07), 0.055).sphere((0.0, 0.12, 0.12), 0.04), M["tox"], J["bub"], outline=0.014)
for sx in (1, -1):
    rf.mk("sflask", B().cone((0.39 * sx, 0, -0.14), (0.39 * sx, 0, 0.12), 0.11, 0.05, seg=10), M["tox"], J["pack"], outline=0.016)
    rf.mk("cork", B().box((0.39 * sx, 0, 0.15), (0.09, 0.09, 0.07)), M["leather"], J["pack"], outline=0.014)

# cabeça: capuz pontudo, rosto no escuro, olhos brilhantes e bico de médico da peste
j("head", "spine", (0, -0.08, 0.56), rot0=(-30, 0, 0), scale=1.1)
rf.mk("hood", B().sphere((0, 0.02, 0.02), 0.28, seg=22).cone((0, 0.12, 0.18), (0, 0.42, 0.4), 0.16, 0, seg=10), M["cloak"], J["head"])
rf.mk("void", B().sphere((0, -0.1, 0), 0.22, (1, 0.8, 1)), M["void"], J["head"], outline=0)
rf.mk("beak", B().cone((0, -0.2, -0.03), (0, -0.52, -0.13), 0.1, 0.02, seg=10), M["bone"], J["head"])
for sx in (1, -1):
    rf.mk("eye", B().sphere((0.1 * sx, -0.27, 0.06), 0.06, (1, 0.5, 1)), M["tox"], J["head"], outline=0.012)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.28 * sx, 0, 0.36))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.08, 0.09), M["cloak"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.22))
    rf.mk("lower" + s, B().cone((0, 0, 0.02), (0, 0, -0.18), 0.09, 0.11), M["cloak"], J["fore" + s])
    rf.mk("hand" + s, B().sphere((0, 0, -0.22), 0.065), M["leather"], J["fore" + s])
j("flask", "foreR", (0, 0, -0.33))
rf.mk("flask", B().sphere((0, 0, 0), 0.12), M["tox"], J["flask"], outline=0.02)
rf.mk("neck", B().cone((0, 0, 0.08), (0, 0, 0.2), 0.05, 0.04, seg=8), M["iron"], J["flask"], outline=0.014)


# ---------------------------------------------------------------- poses
def walk(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=0.035 * abs(cos(ph)))
    rf.rot(J["hips"], 0, 0, 6 * sin(ph))
    rf.rot(J["spine"], 0, 0, -5 * sin(ph))
    rf.rot(J["pack"], 5 * sin(2 * ph))
    rf.rot(J["footL"], -28 * sin(ph))
    rf.rot(J["footR"], 28 * sin(ph))
    rf.rot(J["armL"], 22 * sin(ph), -10, 0)
    rf.rot(J["foreL"], -30)
    rf.rot(J["armR"], -30, 10, 0)          # frasco pronto à frente do corpo
    rf.rot(J["foreR"], -60)
    k = 1 + 0.3 * sin(ph)
    J["bub"].scale = (k, k, k)


def throw(i, n):
    if i == 0:      # braço armado para trás e para cima
        rf.rot(J["spine"], -14, 0, 30); rf.rot(J["head"], 0, 0, -22)
        rf.rot(J["armR"], 150, 10, 0); rf.rot(J["foreR"], -20)
        rf.rot(J["armL"], -40, -14, 0); rf.rot(J["foreL"], -40)
        rf.rot(J["footL"], -18); rf.rot(J["footR"], 16)
    else:           # arremesso (o frasco já saiu da mão)
        k = (1.0, 0.5)[i - 1]
        rf.rot(J["spine"], 16 * k, 0, -25 * k); rf.rot(J["head"], 0, 0, 18 * k)
        rf.rot(J["armR"], -120 * k - 30 * (1 - k), 10, 0); rf.rot(J["foreR"], -10)
        rf.rot(J["armL"], 36 * k, -14, 0); rf.rot(J["foreL"], -30)
        rf.rot(J["footL"], 14 * k); rf.rot(J["footR"], -20 * k)
        J["flask"].scale = (0, 0, 0)
    J["bub"].scale = (1.3, 1.3, 1.3)


ANIMS = [("walk", 4, walk), ("throw", 3, throw)]
if PREVIEW:
    rf.preview(rf.TMP + "/bomber_prev.png", J["root"], [lambda: walk(0, 4), lambda: walk(1, 4), lambda: throw(0, 3), lambda: throw(1, 3)], 320, 2.8, 0.6)
else:
    rf.sheet(rf.OUT + "/enemy_bomber.png", J["root"], ANIMS, 256, 256, 2.8, 0.6)
