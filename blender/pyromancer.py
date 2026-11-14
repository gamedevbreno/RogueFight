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
    robe=rf.toon("robe", "#9a8c92", "#453c44", "#cdc0c6"),
    dark=rf.toon("dark", "#54464e", "#221c22", "#786872"),
    wood=rf.toon("wood", "#4a2c1e", "#20120c", "#70482e"),
    fire=rf.glow("fire", "#ff6a1a"),
    hot=rf.glow("hot", "#ffd23a"),
    void=rf.glow("void", "#120806"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Piromante Cinzento: espectro encapuzado de cinzas, flutuando, com cajado em chamas. Olha para -Y.
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 0.95))
j("robe", "body", (0, 0, 0))
rf.mk("robe", B().cone((0, 0, 0.15), (0, 0.04, -0.45), 0.22, 0.34, seg=14), M["robe"], J["robe"])
j("robe2", "robe", (0, 0.04, -0.45))
tat = B().cone((0, 0, 0.04), (0, 0.08, -0.4), 0.34, 0.08, seg=12)
for a in range(5):
    x, y = 0.24 * cos(a * 1.257), 0.24 * sin(a * 1.257)
    tat.cone((x, y, -0.05), (x * 1.3, y * 1.3 + 0.05, -0.5), 0.1, 0, seg=6)
rf.mk("tatters", tat, M["robe"], J["robe2"])
rf.mk("embers", B().torus(0.33, 0.03, seg=24, c=(0, 0.04, 0.0)), M["fire"], J["robe2"], outline=0)

j("spine", "body", (0, 0, 0.12))
rf.mk("torso", B().sphere((0, 0, 0.2), 0.26, (1, 0.85, 1.05)), M["robe"], J["spine"])
rf.mk("mantle", B().cone((0, 0, 0.44), (0, 0.02, 0.2), 0.12, 0.38, seg=16, flat=(1, 0.85)), M["dark"], J["spine"])
rf.mk("sash", B().box((0, -0.24, 0.12), (0.09, 0.03, 0.5)), M["fire"], J["spine"], outline=0)

j("head", "spine", (0, -0.03, 0.5), rot0=(-22, 0, 0), scale=1.08)
rf.mk("hood", B().sphere((0, 0.02, 0.04), 0.26, seg=22).cone((0, 0.1, 0.2), (0, 0.36, 0.34), 0.15, 0, seg=10), M["dark"], J["head"])
rf.mk("void", B().sphere((0, -0.09, 0.02), 0.2, (1, 0.8, 1.05)), M["void"], J["head"], outline=0)
for sx in (1, -1):
    rf.mk("eye", B().sphere((0.085 * sx, -0.245, 0.06), 0.045, (1.2, 0.5, 0.7), rot=("Y", 20 * sx)), M["hot"], J["head"], outline=0.01)
    rf.mk("eflame", B().cone((0.1 * sx, -0.23, 0.08), (0.2 * sx, -0.2, 0.26), 0.035, 0, seg=6), M["fire"], J["head"], outline=0)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.27 * sx, 0, 0.36))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.24), 0.075, 0.08), M["robe"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.24))
    rf.mk("lower" + s, B().cone((0, 0, 0.02), (0, 0, -0.22), 0.08, 0.13), M["robe"], J["fore" + s])
    rf.mk("hand" + s, B().sphere((0, 0, -0.25), 0.055), M["dark"], J["fore" + s])
# chama na mão esquerda
j("palm", "foreL", (0, 0, -0.36))
rf.mk("palm", B().sphere((0, 0, 0), 0.08).cone((0, 0, 0), (0, 0, 0.24), 0.07, 0, seg=8), M["fire"], J["palm"], outline=0.016)
# cajado na mão direita (eixo local +Z = topo)
j("staff", "foreR", (0, 0, -0.26))
rf.mk("staff", B().cone((0, 0, -0.75), (0, 0, 0.75), 0.035, 0.035, seg=8), M["wood"], J["staff"])
rf.mk("claw", B().cone((0.07, 0, 0.72), (0.14, 0, 0.98), 0.03, 0, seg=6).cone((-0.07, 0, 0.72), (-0.14, 0, 0.98), 0.03, 0, seg=6)
      .cone((0, 0.07, 0.72), (0, 0.14, 0.98), 0.03, 0, seg=6), M["dark"], J["staff"], outline=0.014)
j("orb", "staff", (0, 0, 0.92))
rf.mk("orb", B().sphere((0, 0, 0), 0.12).cone((0, 0, 0.04), (0, 0, 0.36), 0.1, 0, seg=8), M["fire"], J["orb"], outline=0.02)
rf.mk("orb2", B().sphere((0, 0, 0), 0.065), M["hot"], J["orb"], outline=0)


def sway(t, back=0.0):
    rf.rot(J["robe"], back + 4 * sin(2 * pi * t), 0, 4 * sin(2 * pi * t + 1))
    rf.rot(J["robe2"], back * 0.8 + 9 * sin(2 * pi * t - 1), 0, 7 * sin(2 * pi * t))


def staff(total, arm_x, fore_x):
    """`total`: ângulo final do cajado no plano YZ (0 = em pé, 90 = apontando para frente)."""
    rf.rot(J["staff"], total - arm_x - fore_x)


def orb(k):
    J["orb"].scale = (k, k, k)


def float_(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.rot(J["spine"], 3 * b)
    sway(t, 8)
    rf.rot(J["armR"], -30, 12, 0); rf.rot(J["foreR"], -40); staff(8 + 3 * b, -30, -40)
    rf.rot(J["armL"], -20 + 4 * b, -18, 0); rf.rot(J["foreL"], -60)
    orb(1 + 0.12 * b)
    k = 1 + 0.25 * sin(2 * pi * t + 1)
    J["palm"].scale = (k, k, k)


def charging(i, n):
    k = (i + 1) / n
    rf.move(J["body"], dz=0.06 * k)
    rf.rot(J["spine"], -8 * k, 0, 14 * k)
    rf.rot(J["head"], -6 * k)
    sway(0.2 * i, -6 * k)
    rf.rot(J["armR"], -70 * k - 20, 10, 0); rf.rot(J["foreR"], -30); staff(18 + 26 * k, -70 * k - 20, -30)
    rf.rot(J["armL"], -60 * k, -22, 0); rf.rot(J["foreL"], -50)
    orb(1 + 0.8 * k)
    J["palm"].scale = (1 + 0.6 * k,) * 3


ANIMS = [("float", 4, float_), ("charging", 3, charging)]
if PREVIEW:
    rf.preview(rf.TMP + "/pyromancer_prev.png", J["root"], [lambda: float_(0, 4), lambda: float_(2, 4), lambda: charging(0, 3), lambda: charging(2, 3)], 320, 4.0, 1.6)
else:
    rf.sheet(rf.OUT + "/enemy_pyromancer.png", J["root"], ANIMS, 256, 256, 4.0, 1.6)
