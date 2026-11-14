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
    body=rf.toon("body", "#8a2c18", "#3a100a", "#c8502c"),
    dark=rf.toon("dark", "#3a1a16", "#160806", "#5c2c24"),
    bone=rf.toon("bone", "#ffe6c8", "#c89a78", "#ffffff"),
    fire=rf.glow("fire", "#ff7a1a"),
    hot=rf.glow("hot", "#ffd23a"),
    mouth=rf.glow("mouth", "#ff4a12"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Salamandra Ígnea: lagarto baixo e comprido, crista de chamas e cauda em brasa. Olha para -Y.
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 0.36))
rf.mk("torso", B().sphere((0, 0, 0), 0.26, (1.05, 1.9, 0.75)).sphere((0, -0.36, 0.02), 0.25, (1, 1.1, 0.85))
      .sphere((0, 0.42, -0.01), 0.21, (1, 1.2, 0.8)), M["body"], J["body"])
rf.mk("belly", B().sphere((0, 0, -0.1), 0.2, (0.9, 2.3, 0.5)), M["mouth"], J["body"], outline=0)
j("crest", "body", (0, 0, 0.14))
cr, cr2 = B(), B()
for y, h in ((-0.42, 0.3), (-0.22, 0.4), (-0.02, 0.36), (0.18, 0.3), (0.38, 0.22)):
    cr.cone((0, y, 0), (0, y + 0.16, h), 0.085, 0, seg=8)
    cr2.cone((0, y + 0.02, 0.02), (0, y + 0.12, h * 0.62), 0.05, 0, seg=8)
rf.mk("crest", cr, M["fire"], J["crest"], outline=0.02)
rf.mk("crest2", cr2, M["hot"], J["crest"], outline=0)

j("tail", "body", (0, 0.6, 0))
rf.mk("tail1", B().cone((0, -0.08, 0), (0, 0.34, 0.04), 0.14, 0.09), M["body"], J["tail"])
j("tail2", "tail", (0, 0.34, 0.04))
rf.mk("tail2", B().cone((0, -0.02, 0), (0, 0.32, 0.08), 0.09, 0.05), M["body"], J["tail2"])
j("tail3", "tail2", (0, 0.32, 0.08))
rf.mk("tflame", B().cone((0, -0.04, 0), (0, 0.34, 0.26), 0.13, 0, seg=8).cone((0, 0, 0.02), (0.12, 0.2, 0.28), 0.07, 0, seg=8)
      .cone((0, 0, 0.02), (-0.12, 0.2, 0.24), 0.07, 0, seg=8), M["fire"], J["tail3"], outline=0.02)
rf.mk("tflame2", B().cone((0, 0, 0.02), (0, 0.2, 0.17), 0.07, 0, seg=8), M["hot"], J["tail3"], outline=0)

j("head", "body", (0, -0.6, 0.06))
rf.mk("skull", B().sphere((0, -0.04, 0.02), 0.2, (1.05, 1.2, 0.7)).cone((0, -0.12, 0.0), (0, -0.46, -0.03), 0.16, 0.08, seg=12, flat=(1, 0.6)),
      M["body"], J["head"])
for sx in (1, -1):
    rf.mk("eye", B().sphere((0.13 * sx, -0.16, 0.1), 0.05, (1, 0.8, 0.6)), M["hot"], J["head"], outline=0.012)
    rf.mk("frill", B().cone((0.16 * sx, 0.04, 0.06), (0.36 * sx, 0.2, 0.2), 0.08, 0, seg=8), M["fire"], J["head"], outline=0.018)
j("jaw", "head", (0, -0.1, -0.08))
rf.mk("jaw", B().cone((0, 0, 0), (0, -0.33, -0.02), 0.12, 0.06, seg=10, flat=(1, 0.5)), M["dark"], J["jaw"])
rf.mk("maw", B().box((0, -0.17, 0.035), (0.16, 0.26, 0.02)), M["mouth"], J["jaw"], outline=0)
rf.mk("teeth", B().cone((0.06, -0.27, 0.02), (0.06, -0.28, 0.1), 0.022, 0, seg=6).cone((-0.06, -0.27, 0.02), (-0.06, -0.28, 0.1), 0.022, 0, seg=6),
      M["bone"], J["jaw"], outline=0)

# pernas abertas de réptil
for tag, y in (("f", -0.32), ("h", 0.34)):
    for s, sx in (("L", 1), ("R", -1)):
        n = tag + s
        j("leg" + n, "body", (0.2 * sx, y, -0.04), rot0=(0, -38 * sx, 0))
        rf.mk("up" + n, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.085, 0.07), M["body"], J["leg" + n])
        j("low" + n, "leg" + n, (0, 0, -0.22), rot0=(0, 38 * sx, 0))
        rf.mk("low" + n, B().cone((0, 0, 0.02), (0, -0.03, -0.14), 0.065, 0.05).sphere((0, -0.07, -0.15), 0.08, (1.2, 1.4, 0.55)), M["dark"], J["low" + n])
        cl = B()
        for cx in (-0.05, 0, 0.05):
            cl.cone((cx, -0.15, -0.15), (cx * 1.5, -0.27, -0.18), 0.022, 0, seg=6)
        rf.mk("claw" + n, cl, M["bone"], J["low" + n], outline=0.012)


def tail(t, amp=1.0, up=0.0):
    for k, name in enumerate(("tail", "tail2", "tail3")):
        rf.rot(J[name], up * (0.5 + 0.3 * k), 0, (18 + 8 * k) * amp * sin(2 * pi * t - k * 0.9))


def legs(front, hind):
    for s in ("L", "R"):
        rf.rot(J["legf" + s], front[0] if s == "L" else front[1])
        rf.rot(J["legh" + s], hind[0] if s == "L" else hind[1])


def flame(k):
    J["crest"].scale = (1, 1, k)


def chase(i, n):
    ph = 2 * pi * i / n
    rf.move(J["body"], dz=0.03 * sin(2 * ph))
    rf.rot(J["body"], 0, 0, 9 * sin(ph))          # serpenteia
    rf.rot(J["head"], 0, 0, -12 * sin(ph))
    rf.rot(J["jaw"], -8)
    legs((-42 * sin(ph), 42 * sin(ph)), (42 * sin(ph), -42 * sin(ph)))
    tail(i / n, 1.0)
    flame(1 + 0.25 * sin(2 * ph))


def windup(i, n):
    k = (i + 1) / n
    rf.move(J["body"], dy=0.1 * k, dz=-0.1 * k)
    rf.rot(J["body"], -8 * k)
    rf.rot(J["head"], 12 * k)
    rf.rot(J["jaw"], -8 - 26 * k)
    legs((-30 * k, -30 * k), (-24 * k, -24 * k))
    tail(0.25 * i, 0.5, -20 * k)
    flame(1 + 0.7 * k)


def lunge(i, n):
    k = 1 - 0.25 * i
    rf.move(J["body"], dy=-0.14 * k, dz=0.08 * k)
    rf.rot(J["body"], 8 * k)
    rf.rot(J["head"], -8 * k)
    rf.rot(J["jaw"], -44 * k)
    legs((-64 * k, -56 * k), (58 * k, 50 * k))
    tail(0.3 * i, 0.3, 14 * k)
    flame(1.9)


ANIMS = [("chase", 4, chase), ("windup", 2, windup), ("lunge", 2, lunge)]
if PREVIEW:
    rf.preview(rf.TMP + "/hellhound_prev.png", J["root"], [lambda: chase(0, 4), lambda: chase(1, 4), lambda: windup(1, 2), lambda: lunge(0, 2)], 320, 3.9, 0.4)
else:
    rf.sheet(rf.OUT + "/enemy_hellhound.png", J["root"], ANIMS, 256, 256, 3.9, 0.4)
