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
    body=rf.toon("body", "#ff3d81", "#a3164c", "#ff8ab3"),
    dark=rf.toon("dark", "#4a1030", "#22061a", "#7a1c4c"),
    bone=rf.toon("bone", "#fff0dc", "#d9a890", "#ffffff"),
    eye=rf.glow("eye", "#fff36b"),
    mouth=rf.glow("mouth", "#2a0616"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# fera das sombras quadrúpede, olhando para -Y
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 0.5))
rf.mk("torso", B().sphere((0, 0, 0), 0.3, (0.9, 1.45, 0.82)).sphere((0, -0.3, 0.04), 0.31, (1, 1, 0.95))
      .sphere((0, 0.34, -0.02), 0.25), M["body"], J["body"])
rf.mk("belly", B().sphere((0, -0.05, -0.12), 0.24, (0.8, 1.6, 0.6)), M["dark"], J["body"], outline=0)
sp = B()
for y, h in ((-0.32, 0.26), (-0.12, 0.32), (0.08, 0.28), (0.26, 0.22), (0.42, 0.15)):
    sp.cone((0, y, 0.2), (0, y + 0.14, 0.2 + h), 0.075, 0, seg=8)
rf.mk("spines", sp, M["dark"], J["body"])

j("tail", "body", (0, 0.52, 0.03))
rf.mk("tail1", B().cone((0, -0.06, 0), (0, 0.28, 0.14), 0.09, 0.055), M["body"], J["tail"])
j("tail2", "tail", (0, 0.28, 0.14))
rf.mk("tail2", B().cone((0, -0.02, 0), (0, 0.26, 0.16), 0.056, 0, seg=10).cone((0, 0.2, 0.1), (0, 0.4, 0.3), 0.07, 0, seg=6, flat=(0.4, 1)),
      M["dark"], J["tail2"])

j("head", "body", (0, -0.52, 0.14))
rf.mk("skull", B().sphere((0, -0.06, 0.02), 0.22, (0.95, 1.15, 0.88)).cone((0, -0.14, -0.01), (0, -0.44, -0.05), 0.15, 0.07, seg=12),
      M["body"], J["head"])
for sx in (1, -1):
    rf.mk("eye", B().sphere((0.12 * sx, -0.21, 0.09), 0.055, (1.1, 0.7, 0.55), rot=("Y", 24 * sx)), M["eye"], J["head"], outline=0.012)
    rf.mk("horn", B().cone((0.12 * sx, 0.0, 0.14), (0.26 * sx, 0.06, 0.4), 0.07, 0.04, seg=10)
          .cone((0.26 * sx, 0.06, 0.4), (0.24 * sx, -0.1, 0.58), 0.04, 0, seg=10).sphere((0.26 * sx, 0.06, 0.4), 0.04),
          M["bone"], J["head"])
    rf.mk("fang", B().cone((0.07 * sx, -0.36, -0.07), (0.07 * sx, -0.38, -0.2), 0.03, 0, seg=6), M["bone"], J["head"], outline=0.012)
j("jaw", "head", (0, -0.1, -0.1))
rf.mk("jaw", B().cone((0, 0, 0), (0, -0.3, -0.03), 0.11, 0.05, seg=10, flat=(1, 0.6)), M["dark"], J["jaw"])
rf.mk("maw", B().box((0, -0.16, 0.035), (0.14, 0.24, 0.02)), M["mouth"], J["jaw"], outline=0)
rf.mk("teeth", B().cone((0.05, -0.24, 0.02), (0.05, -0.25, 0.11), 0.022, 0, seg=6).cone((-0.05, -0.24, 0.02), (-0.05, -0.25, 0.11), 0.022, 0, seg=6),
      M["bone"], J["jaw"], outline=0)

for tag, y, big in (("f", -0.3, 1.0), ("h", 0.32, 1.15)):
    for s, sx in (("L", 1), ("R", -1)):
        n = tag + s
        j("leg" + n, "body", (0.21 * sx, y, -0.05))
        rf.mk("up" + n, B().cone((0, 0, 0.04), (0, 0.03, -0.22), 0.1 * big, 0.075), M["body"], J["leg" + n])
        j("low" + n, "leg" + n, (0, 0.03, -0.22))
        paw = B().cone((0, 0, 0.02), (0, -0.04, -0.2), 0.07, 0.055).sphere((0, -0.07, -0.21), 0.085, (1, 1.4, 0.6))
        rf.mk("low" + n, paw, M["dark"], J["low" + n])
        cl = B()
        for cx in (-0.05, 0, 0.05):
            cl.cone((cx, -0.15, -0.21), (cx * 1.4, -0.27, -0.25), 0.024, 0, seg=6)
        rf.mk("claw" + n, cl, M["bone"], J["low" + n], outline=0.012)


# ---------------------------------------------------------------- poses
def tailwave(t, amp=1.0, up=0.0):
    rf.rot(J["tail"], up + 8 * amp * sin(2 * pi * t), 0, 16 * amp * sin(2 * pi * t + 1))
    rf.rot(J["tail2"], up * 0.6 + 12 * amp * sin(2 * pi * t - 1), 0, 20 * amp * sin(2 * pi * t))


def legs(front, hind, bend_f=0.0, bend_h=0.0):
    for s in ("L", "R"):
        rf.rot(J["legf" + s], front[0] if s == "L" else front[1])
        rf.rot(J["lowf" + s], bend_f)
        rf.rot(J["legh" + s], hind[0] if s == "L" else hind[1])
        rf.rot(J["lowh" + s], bend_h)


def chase(i, n):
    ph = 2 * pi * i / n
    rf.move(J["body"], dz=0.05 * sin(ph))
    rf.rot(J["body"], 7 * cos(ph))
    rf.rot(J["head"], -8 * cos(ph))
    rf.rot(J["jaw"], -10)
    legs((-46 * sin(ph), -46 * sin(ph + 0.9)), (40 * sin(ph), 40 * sin(ph + 0.9)), 22, -18)
    tailwave(i / n, 1.0, -10)


def windup(i, n):
    k = (i + 1) / n
    rf.move(J["body"], dy=0.1 * k, dz=-0.16 * k)
    rf.rot(J["body"], -13 * k)             # traseira alta, frente baixa
    rf.rot(J["head"], 14 * k)
    rf.rot(J["jaw"], -8 - 22 * k)
    legs((-30 * k, -30 * k), (-28 * k, -28 * k), 60 * k, 48 * k)
    tailwave(0.25 * i, 0.5, -35 * k)


def lunge(i, n):
    k = 1 - 0.25 * i
    rf.move(J["body"], dy=-0.14 * k, dz=0.12 * k)
    rf.rot(J["body"], 13 * k)
    rf.rot(J["head"], -12 * k)
    rf.rot(J["jaw"], -42 * k)
    legs((-72 * k, -60 * k), (64 * k, 56 * k), -10, -20)
    tailwave(0.3 * i, 0.4, 26 * k)


ANIMS = [("chase", 4, chase), ("windup", 2, windup), ("lunge", 2, lunge)]
if PREVIEW:
    rf.preview(rf.TMP + "/chaser_prev.png", J["root"], [lambda: chase(0, 4), lambda: chase(1, 4), lambda: windup(1, 2), lambda: lunge(0, 2)], 320, 2.9, 0.5)
else:
    rf.sheet(rf.OUT + "/enemy_chaser.png", J["root"], ANIMS, 256, 256, 2.9, 0.5)
