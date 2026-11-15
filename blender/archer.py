import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import rf

importlib.reload(rf)
PREVIEW = bool(globals().get("PREVIEW")) or "--preview" in sys.argv
from math import sin, cos, pi, radians
B = rf.B

rf.reset()
M = dict(
    coat=rf.toon("coat", "#256a48", "#0e2e20", "#3ca06e"),
    pants=rf.toon("pants", "#2a3a34", "#101a16"),
    boot=rf.toon("boot", "#3a2a1e", "#180f0a"),
    leather=rf.toon("leather", "#6a4a2e", "#30200f", "#946c44"),
    skin=rf.toon("skin", "#ffd9b8", "#e39a86", "#fff1e2"),
    hair=rf.toon("hair", "#3a2c24", "#18100c", "#3a2c24"),
    neon=rf.glow("neon", "#4dff88"),
    white=rf.glow("white", "#ffffff"),
    dark=rf.glow("dark", "#06281a"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Caçador Astral: arqueiro ágil de capuz verde-escuro com detalhes neon, cachecol,
# aljava nas costas e arco energético na mão esquerda. Olha para -Y.
j("root", None, (0, 0, 0))
j("hips", "root", (0, 0, 0.85))
rf.mk("pelvis", B().sphere((0, 0, 0), 0.165, (1.1, 0.85, 0.7)), M["pants"], J["hips"])
for s, sx in (("L", 1), ("R", -1)):
    j("leg" + s, "hips", (0.1 * sx, 0, -0.03))
    rf.mk("thigh" + s, B().cone((0, 0, 0.03), (0, 0, -0.38), 0.1, 0.08), M["pants"], J["leg" + s])
    j("shin" + s, "leg" + s, (0, 0, -0.38))
    rf.mk("boot" + s, B().cone((0, 0, 0.03), (0, 0, -0.32), 0.085, 0.072).sphere((0, -0.045, -0.36), 0.09, (1, 1.55, 0.75)), M["boot"], J["shin" + s])
    rf.mk("btrim" + s, B().cone((0, 0, -0.02), (0, 0, -0.06), 0.09, 0.09), M["neon"], J["shin" + s], outline=0)

j("spine", "hips", (0, 0, 0.05))
rf.mk("torso", B().cone((0, 0, -0.04), (0, 0, 0.37), 0.155, 0.19, flat=(1, 0.8)).sphere((0, 0, 0.36), 0.19, (1.2, 0.78, 0.5)), M["coat"], J["spine"])
rf.mk("strap", B().box((0, -0.165, 0.18), (0.06, 0.03, 0.46), rot=("Y", 38)), M["leather"], J["spine"], outline=0)
rf.mk("belt", B().cone((0, 0, -0.02), (0, 0, 0.04), 0.165, 0.155, flat=(1, 0.85)), M["leather"], J["spine"], outline=0)
rf.mk("buckle", B().box((0, -0.15, 0.01), (0.07, 0.03, 0.06)), M["neon"], J["spine"], outline=0)
# abas do sobretudo
for s, sx in (("L", 1), ("R", -1)):
    j("tail" + s, "spine", (0.09 * sx, 0.12, 0.0))
    rf.mk("tail" + s, B().box((0, 0, -0.24), (0.2, 0.045, 0.5)), M["coat"], J["tail" + s], bevel=0.015)
    rf.mk("tailT" + s, B().box((0, 0, -0.48), (0.205, 0.05, 0.035)), M["neon"], J["tail" + s], outline=0)
# aljava nas costas, com penas neon
j("quiver", "spine", (-0.1, 0.19, 0.2), rot0=(0, 24, 0))
rf.mk("quiver", B().cone((0, 0, -0.26), (0, 0, 0.26), 0.07, 0.085, seg=10), M["leather"], J["quiver"])
fl = B()
for x, y in ((0.03, 0.0), (-0.03, 0.02), (0.0, -0.03)):
    fl.cone((x, y, 0.24), (x * 1.6, y * 1.6, 0.46), 0.03, 0.012, seg=5)
rf.mk("fletch", fl, M["neon"], J["quiver"], outline=0.012)
# cachecol esvoaçante
j("scarf", "spine", (0.1, 0.15, 0.44))
rf.mk("sc1", B().box((0, 0, -0.14), (0.12, 0.035, 0.32)), M["neon"], J["scarf"], bevel=0.01)
j("scarf2", "scarf", (0, 0, -0.29))
rf.mk("sc2", B().box((0, 0, -0.13), (0.11, 0.03, 0.3)), M["neon"], J["scarf2"], bevel=0.01)
rf.mk("wrap", B().torus(0.15, 0.05, seg=20, c=(0, 0.01, 0.42)), M["neon"], J["spine"], outline=0.016)

# cabeça com capuz
j("head", "spine", (0, 0, 0.47), rot0=(-20, 0, 0), scale=1.18)
rf.mk("face", B().sphere((0, 0, 0.2), 0.24, (1, 0.96, 1), seg=28), M["skin"], J["head"])
for sx in (1, -1):
    x = 0.098 * sx
    rf.mk("eyeW", B().sphere((x, -0.21, 0.175), 0.062, (0.82, 0.3, 1.15)), M["white"], J["head"], outline=0)
    rf.mk("eyeI", B().sphere((x, -0.228, 0.168), 0.047, (0.82, 0.3, 1.1)), M["neon"], J["head"], outline=0)
    rf.mk("eyeP", B().sphere((x, -0.24, 0.164), 0.023, (0.8, 0.3, 1.25)).box((x, -0.224, 0.246), (0.125, 0.02, 0.024), rot=("Y", 8 * sx)), M["dark"], J["head"], outline=0)
    rf.mk("eyeS", B().sphere((x + 0.022, -0.246, 0.196), 0.014), M["white"], J["head"], outline=0)
rf.mk("mouth", B().box((0, -0.234, 0.07), (0.05, 0.012, 0.012)), M["dark"], J["head"], outline=0)
rf.mk("fringe", B().cone((0.04, -0.19, 0.4), (0.1, -0.255, 0.27), 0.08, 0.01, seg=8).cone((-0.1, -0.18, 0.39), (-0.16, -0.24, 0.29), 0.07, 0.01, seg=8), M["hair"], J["head"])
rf.mk("hood", B().sphere((0, 0.05, 0.25), 0.285, (1.04, 1.02, 1.02), seg=24).cone((0, 0.16, 0.42), (0, 0.44, 0.5), 0.17, 0, seg=10)
      .cone((0.2, -0.06, 0.34), (0.26, -0.12, 0.04), 0.09, 0.03, seg=8).cone((-0.2, -0.06, 0.34), (-0.26, -0.12, 0.04), 0.09, 0.03, seg=8), M["coat"], J["head"])
rf.mk("hoodT", B().torus(0.2, 0.022, seg=24, c=(0, -0.13, 0.31)), M["neon"], J["head"], outline=0)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.26 * sx, 0, 0.36))
    rf.mk("upper" + s, B().cone((0, 0, 0.03), (0, 0, -0.27), 0.08, 0.066), M["coat"], J["arm" + s])
    j("fore" + s, "arm" + s, (0, 0, -0.27))
    rf.mk("bracer" + s, B().cone((0, 0, 0.03), (0, 0, -0.22), 0.07, 0.066), M["leather"], J["fore" + s])
    rf.mk("cuff" + s, B().cone((0, 0, -0.17), (0, 0, -0.21), 0.07, 0.07), M["neon"], J["fore" + s], outline=0)
    rf.mk("hand" + s, B().sphere((0, 0, -0.27), 0.066), M["skin"], J["fore" + s])

# arco energético na mão esquerda: plano local XZ, a corda fica do lado do corpo
j("bow", "foreL", (0, 0, -0.28))
bow, glowb = B(), B()
N, R, SPAN = 8, 0.5, 62
for k in range(N):
    a0, a1 = radians(-SPAN + 2 * SPAN * k / N), radians(-SPAN + 2 * SPAN * (k + 1) / N)
    p0 = (0, -R * cos(a0) + R * 0.72, R * sin(a0))
    p1 = (0, -R * cos(a1) + R * 0.72, R * sin(a1))
    bow.cone(p0, p1, 0.032, 0.032, seg=6)
    bow.sphere(p1, 0.032)
tip_y = -R * cos(radians(SPAN)) + R * 0.72
tip_z = R * sin(radians(SPAN))
rf.mk("bow", bow, M["leather"], J["bow"])
glowb.cone((0, tip_y, -tip_z), (0, tip_y, tip_z), 0.012, 0.012, seg=5)
glowb.sphere((0, tip_y, tip_z), 0.05).sphere((0, tip_y, -tip_z), 0.05)
rf.mk("string", glowb, M["neon"], J["bow"], outline=0)
j("arrow", "bow", (0, 0, 0))
rf.mk("arrow", B().cone((0, 0.34, 0), (0, -0.42, 0), 0.016, 0.016, seg=5).cone((0, -0.42, 0), (0, -0.56, 0), 0.045, 0, seg=6), M["neon"], J["arrow"], outline=0.012)


# ---------------------------------------------------------------- poses
def flutter(t, amp=1.0, back=0.0):
    for k, s in enumerate(("L", "R")):
        sx = 1 if s == "L" else -1
        ph = 2 * pi * t + k * 1.3
        rf.rot(J["tail" + s], back + 6 * amp * sin(ph), 0, 5 * amp * sin(ph + 1) * sx)
    rf.rot(J["scarf"], 18 + back * 0.8 + 10 * amp * sin(t * 2 * pi + 2), 0, 10 * amp * sin(t * 2 * pi))
    rf.rot(J["scarf2"], 10 + back * 0.3 + 15 * amp * sin(t * 2 * pi + 0.8))


def arrow(on):
    J["arrow"].scale = (1, 1, 1) if on else (0, 0, 0)


def idle(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["spine"], dz=0.012 * b)
    rf.rot(J["head"], -2 * b)
    for s, sx in (("L", 1), ("R", -1)):
        rf.rot(J["leg" + s], 0, -5 * sx, 0)
    rf.rot(J["armL"], -24 + 3 * b, -14, 0); rf.rot(J["foreL"], -40)
    rf.rot(J["armR"], 3 * b, 9, 0); rf.rot(J["foreR"], -14)
    rf.rot(J["bow"], 60, 0, 0)        # arco em pé ao lado do corpo
    arrow(False)
    flutter(t, 0.7, 6)


def run(i, n):
    ph = 2 * pi * i / n
    rf.move(J["hips"], dz=-0.035 + 0.05 * abs(cos(ph)))
    rf.rot(J["spine"], 18, 0, 9 * sin(ph))
    rf.rot(J["head"], -10, 0, -6 * sin(ph))
    for s, sx, p in (("L", 1, ph), ("R", -1, ph + pi)):
        rf.rot(J["leg" + s], -46 * sin(p), 0, 0)
        rf.rot(J["shin" + s], 12 + 60 * max(0, cos(p)))
    rf.rot(J["armL"], -30 + 14 * sin(ph), -12, 0); rf.rot(J["foreL"], -50)
    rf.rot(J["armR"], -40 * sin(ph), 8, 0); rf.rot(J["foreR"], -50)
    rf.rot(J["bow"], 70, 0, 0)
    arrow(False)
    flutter(i / n, 1.2, 50)


def shoot(i, n):
    # puxa a corda, segura no ponto máximo, solta
    pull = (0.6, 1.0, 0.15)[i]
    rf.move(J["hips"], dz=-0.04)
    rf.rot(J["spine"], 0, 0, 34)                   # corpo de lado para o alvo
    rf.rot(J["head"], 0, 0, -30)
    rf.rot(J["legL"], -16, -8, 0); rf.rot(J["legR"], 14, 8, 0)
    rf.rot(J["armL"], -90, 0, -34); rf.rot(J["foreL"], 0)   # braço do arco estendido para o alvo (desfaz o giro do tronco)
    rf.rot(J["bow"], 90, 0, 0)
    rf.rot(J["armR"], -84, 0, -34 - 14 * pull); rf.rot(J["foreR"], -20 - 110 * pull)   # mão da corda recua até o rosto
    arrow(i < 2)
    rf.move(J["arrow"], dy=0.2 * pull)
    flutter(0.3 * i, 0.6, 10 + 14 * pull)


def dash(i, n):
    # salto acrobático: corpo quase horizontal, pernas recolhidas
    k = (0.7, 1.0)[i]
    rf.move(J["hips"], dy=-0.1 * k, dz=0.1 * k)
    rf.rot(J["hips"], 40 * k, 0, 0)
    rf.rot(J["spine"], 24 * k, 0, -20 * k)
    rf.rot(J["head"], -34 * k, 0, 14 * k)
    rf.rot(J["legL"], -70 * k, 0, 0); rf.rot(J["shinL"], 96 * k)
    rf.rot(J["legR"], 20 * k, 0, 0); rf.rot(J["shinR"], 60 * k)
    rf.rot(J["armL"], -110 * k, -10, 0); rf.rot(J["foreL"], -10)
    rf.rot(J["armR"], 60 * k, 10, 0); rf.rot(J["foreR"], -30)
    rf.rot(J["bow"], 90, 0, 0)
    arrow(False)
    flutter(0.2 * i, 1.0, 70 * k)


ANIMS = [("idle", 4, idle), ("run", 6, run), ("shoot", 3, shoot), ("dash", 2, dash)]
POSES = [lambda: idle(0, 4), lambda: run(1, 6), lambda: shoot(1, 3), lambda: shoot(2, 3), lambda: dash(1, 2)]
if PREVIEW:
    rf.preview(rf.TMP + "/archer_prev.png", J["root"], POSES, 320, 3.2, 1.0)
else:
    rf.sheet(rf.OUT + "/player_archer.png", J["root"], ANIMS, 256, 256, 3.2, 1.0)
