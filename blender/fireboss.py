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
    armor=rf.toon("armor", "#6e5a62", "#2c2026", "#9c868e"),
    ash=rf.toon("ash", "#8a7c80", "#3a3034", "#c4b6ba"),
    cape=rf.toon("cape", "#5a2014", "#240c08", "#8a3a22"),
    bone=rf.toon("bone", "#ffe9c8", "#c8a078", "#ffffff"),
    magma=rf.glow("magma", "#ff6a14"),
    hot=rf.glow("hot", "#ffd23a"),
    void=rf.glow("void", "#140806"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# Senhor das Cinzas: rei colossal de cinza e magma, coroa em chamas, capa de brasas. Olha para -Y.
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 1.5))

# pedestal de magma no lugar das pernas
j("skirt", "body", (0, 0, 0.1))
rf.mk("skirt", B().cone((0, 0, 0.15), (0, 0, -0.85), 0.5, 0.78, seg=10), M["armor"], J["skirt"], smooth=False)
rf.mk("lava", B().cone((0, 0, -0.8), (0, 0, -1.45), 0.7, 0.95, seg=14), M["magma"], J["skirt"], outline=0.03)
rf.mk("lava2", B().torus(0.62, 0.06, seg=24, c=(0, 0, -0.5)).torus(0.5, 0.05, seg=24, c=(0, 0, 0.1)), M["hot"], J["skirt"], outline=0)

j("spine", "body", (0, 0, 0.2))
rf.mk("torso", B().sphere((0, 0, 0.55), 0.68, (1.15, 0.85, 1.0), seg=9, rot=("Z", 20)), M["armor"], J["spine"], smooth=False)
rf.mk("core", B().sphere((0, -0.56, 0.6), 0.2, (1, 0.5, 1.3)), M["hot"], J["spine"], outline=0.024)
ribs = B()
for z, w in ((0.92, 0.5), (0.3, 0.42)):
    for sx in (1, -1):
        ribs.box((0.26 * sx, -0.55, z), (w, 0.08, 0.07), rot=("Y", 24 * sx))
rf.mk("ribs", ribs, M["magma"], J["spine"], outline=0)

# capa de cinzas (3 painéis encadeados)
for k, x in enumerate((-0.5, 0.0, 0.5)):
    j(f"cape{k}", "spine", (x, 0.5, 1.0))
    rf.mk(f"cape{k}", B().box((0, 0, -0.55), (0.52, 0.06, 1.15)), M["cape"], J[f"cape{k}"], bevel=0.02)
    j(f"cape{k}b", f"cape{k}", (0, 0, -1.1))
    rf.mk(f"cape{k}b", B().box((0, 0, -0.42), (0.54, 0.05, 0.9)), M["cape"], J[f"cape{k}b"], bevel=0.02)
    rf.mk(f"cape{k}e", B().box((0, 0, -0.86), (0.55, 0.06, 0.07)), M["magma"], J[f"cape{k}b"], outline=0)

# cabeça: caveira de cinza com coroa de chamas
j("head", "spine", (0, -0.12, 1.32), rot0=(-14, 0, 0))
rf.mk("skull", B().sphere((0, 0, 0.1), 0.32, (1, 1.05, 1.05), seg=22).box((0, -0.16, -0.14), (0.3, 0.26, 0.2)), M["ash"], J["head"])
rf.mk("sockets", B().sphere((0.12, -0.27, 0.12), 0.09, (1, 0.5, 1.1)).sphere((-0.12, -0.27, 0.12), 0.09, (1, 0.5, 1.1))
      .box((0, -0.3, -0.12), (0.22, 0.05, 0.07)), M["void"], J["head"], outline=0)
rf.mk("eyes", B().sphere((0.12, -0.3, 0.12), 0.045, (1, 0.5, 1)).sphere((-0.12, -0.3, 0.12), 0.045, (1, 0.5, 1)), M["hot"], J["head"], outline=0)
j("crown", "head", (0, 0, 0.3))
rf.mk("band", B().torus(0.33, 0.06, seg=24), M["armor"], J["crown"])
cs, cf = B(), B()
for a in range(7):
    x, y = 0.33 * cos(a * 0.8976), 0.33 * sin(a * 0.8976)
    h = 0.5 + 0.18 * (a % 2)
    cs.cone((x, y, 0), (x * 1.25, y * 1.25, h), 0.09, 0, seg=6)
    cf.cone((x * 1.2, y * 1.2, h * 0.75), (x * 1.3, y * 1.3, h + 0.3), 0.07, 0, seg=6)
rf.mk("spikes", cs, M["bone"], J["crown"])
rf.mk("cflames", cf, M["magma"], J["crown"], outline=0.02)

for s, sx in (("L", 1), ("R", -1)):
    j("arm" + s, "spine", (0.92 * sx, 0, 0.95))
    rf.mk("pad" + s, B().sphere((0.05 * sx, 0, 0.1), 0.46, (1.1, 1, 0.85), seg=8, rot=("Z", 30 * sx)), M["armor"], J["arm" + s], smooth=False)
    fl = B()
    for ax, ay, h in ((0.0, 0.0, 0.7), (0.24, 0.1, 0.5), (-0.1, 0.2, 0.55)):
        fl.cone((ax * sx + 0.05 * sx, ay, 0.3), (ax * sx * 1.6 + 0.1 * sx, ay * 1.5, 0.3 + h), 0.14, 0, seg=7)
    rf.mk("pflame" + s, fl, M["magma"], J["arm" + s], outline=0.024)
    rf.mk("upper" + s, B().cone((0.03 * sx, 0, -0.1), (0.03 * sx, 0, -0.7), 0.19, 0.16, seg=10), M["ash"], J["arm" + s])
    j("fore" + s, "arm" + s, (0.03 * sx, 0, -0.7))
    rf.mk("elb" + s, B().sphere((0, 0, 0), 0.17), M["magma"], J["fore" + s], outline=0)
    rf.mk("gaunt" + s, B().cone((0, 0, 0.02), (0, 0, -0.56), 0.2, 0.27, seg=8), M["armor"], J["fore" + s], smooth=False)
    rf.mk("hand" + s, B().sphere((0, 0, -0.68), 0.23), M["ash"], J["fore" + s])
    cl = B()
    for kx in (-0.13, 0, 0.13):
        cl.cone((kx, -0.1, -0.8), (kx * 1.4, -0.22, -1.12), 0.05, 0, seg=6)
    rf.mk("claw" + s, cl, M["bone"], J["fore" + s], outline=0.02)
    j("palm" + s, "fore" + s, (0, 0, -0.95))
    rf.mk("palm" + s, B().sphere((0, 0, 0), 0.16).cone((0, 0, 0), (0, 0, 0.5), 0.14, 0, seg=8), M["hot"], J["palm" + s], outline=0.024)


def cape(t, back=0.0):
    for k in range(3):
        ph = 2 * pi * t + k * 1.1
        rf.rot(J[f"cape{k}"], back + 5 * sin(ph), 0, 3 * sin(ph + 1))
        rf.rot(J[f"cape{k}b"], back * 0.5 + 9 * sin(ph - 1))


def arm(s, a=(0, 0, 0), fore=0.0, fire=0.0):
    rf.rot(J["arm" + s], *a)
    rf.rot(J["fore" + s], fore)
    J["palm" + s].scale = (fire, fire, fire)


def walk(i, n):
    t = i / n
    b = sin(2 * pi * t)
    rf.move(J["body"], dz=0.06 * b)
    rf.rot(J["spine"], 5, 0, 4 * b)
    rf.rot(J["head"], 0, 0, -4 * b)
    arm("L", (10 * b, -16, 0), -30)
    arm("R", (-10 * b, 16, 0), -30)
    cape(t, 12)
    J["crown"].scale = (1, 1, 1 + 0.12 * b)


def wave(i, n):
    # onda de fogo: junta os braços na frente e os abre de uma vez
    if i == 0:
        rf.rot(J["spine"], 16); rf.rot(J["head"], -10)
        arm("L", (-70, 30, 0), -40, 0.7); arm("R", (-70, -30, 0), -40, 0.7)
        cape(0, 0)
    elif i == 1:
        rf.move(J["body"], dz=0.1)
        rf.rot(J["spine"], -6)
        arm("L", (-60, -40, 0), -20, 1.2); arm("R", (-60, 40, 0), -20, 1.2)
        cape(0.3, 14)
    else:
        rf.move(J["body"], dz=0.14)
        rf.rot(J["spine"], -14); rf.rot(J["head"], 10)
        arm("L", (-20, -105, 0), -8, 1.6); arm("R", (-20, 105, 0), -8, 1.6)
        cape(0.6, 34)
    J["crown"].scale = (1, 1, 1.3)


def cast(i, n):
    # invoca do céu: braços subindo até ficarem erguidos, cabeça para trás
    k = (0.45, 0.8, 1.0)[i]
    rf.move(J["body"], dz=0.12 * k)
    rf.rot(J["spine"], -12 * k)
    rf.rot(J["head"], 22 * k)
    arm("L", (-170 * k, 16, 0), -14, 0.6 + 1.2 * k)
    arm("R", (-170 * k, -16, 0), -14, 0.6 + 1.2 * k)
    cape(0.25 * i, 22 * k)
    J["crown"].scale = (1, 1, 1 + 0.5 * k)


ANIMS = [("walk", 4, walk), ("wave", 3, wave), ("cast", 3, cast)]
if PREVIEW:
    rf.preview(rf.TMP + "/fireboss_prev.png", J["root"], [lambda: walk(0, 4), lambda: wave(0, 3), lambda: wave(2, 3), lambda: cast(2, 3)], 320, 6.8, 1.9)
else:
    rf.sheet(rf.OUT + "/enemy_fireboss.png", J["root"], ANIMS, 384, 384, 6.8, 1.9)
rf.OUTLINE_W = 0.026
