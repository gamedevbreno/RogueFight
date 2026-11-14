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
    body=rf.toon("body", "#ffb02e", "#b8600f", "#ffe08a"),
    gold=rf.toon("gold", "#e08a12", "#8a4a08", "#ffd060"),
    socket=rf.glow("socket", "#2a1400"),
    iris=rf.glow("iris", "#fff2a0"),
    pupil=rf.glow("pupil", "#3a1c00"),
    rune=rf.glow("rune", "#fff6c8"),
    wisp=rf.toon("wisp", "#ffd060", "#d98a12", "#fff2c0"),
)
J = {}


def j(name, parent, loc, rot0=(0, 0, 0), scale=1.0):
    J[name] = rf.joint(name, J.get(parent), loc, rot0, scale)
    return J[name]


# olho rúnico flutuante com dois anéis e tentáculos etéreos
j("root", None, (0, 0, 0))
j("body", "root", (0, 0, 1.0))
core = B().sphere((0, 0, 0), 0.32, seg=28)
for a in (-50, 0, 50):  # coroa de espinhos
    core.cone((0.2 * sin(radians(a)), 0.05, 0.22), (0.42 * sin(radians(a)), 0.1, 0.52 + 0.08 * cos(radians(a))), 0.085, 0, seg=8)
rf.mk("core", core, M["body"], J["body"])
j("eye", "body", (0, 0, 0), rot0=(-18, 0, 0))
rf.mk("socket", B().sphere((0, -0.16, 0), 0.25, (1, 0.72, 1), seg=24), M["socket"], J["eye"], outline=0)
j("iris", "eye", (0, -0.31, 0))
rf.mk("iris", B().sphere((0, 0, 0), 0.15, (1, 0.3, 1), seg=24), M["iris"], J["iris"], outline=0)
rf.mk("pupil", B().sphere((0, -0.035, 0), 0.05, (0.55, 0.3, 2.3)), M["pupil"], J["iris"], outline=0)

for name, R, tilt in (("ringA", 0.52, (62, 0, 20)), ("ringB", 0.66, (-58, 0, -30))):
    j(name + "t", "body", (0, 0, 0), rot0=tilt)
    j(name, name + "t", (0, 0, 0))
    rf.mk(name, B().torus(R, 0.035, seg=40), M["gold"], J[name])
    beads = B()
    for k in range(6):
        a = 2 * pi * k / 6
        beads.box((R * cos(a), R * sin(a), 0), (0.1, 0.1, 0.1), rot=(("Z", 60 * k), ("X", 45)))
    rf.mk(name + "b", beads, M["rune"], J[name], outline=0.018, smooth=False)

for k, (x, y) in enumerate(((0.16, -0.08), (-0.16, -0.08), (0.12, 0.14), (-0.12, 0.14))):
    j(f"t{k}", "body", (x, y, -0.26))
    rf.mk(f"t{k}", B().cone((0, 0, 0.06), (0, 0, -0.26), 0.07, 0.05, seg=10), M["wisp"], J[f"t{k}"])
    j(f"t{k}b", f"t{k}", (0, 0, -0.26))
    rf.mk(f"t{k}b", B().cone((0, 0, 0.02), (0, 0, -0.3), 0.05, 0, seg=10).sphere((0, 0, 0), 0.05), M["wisp"], J[f"t{k}b"])


def tent(t, curl=0.0, amp=1.0):
    for k in range(4):
        ph = 2 * pi * t + k * 1.6
        sx = 1 if k % 2 == 0 else -1
        rf.rot(J[f"t{k}"], 12 * amp * sin(ph) + curl * 0.5, (10 + 8 * amp * sin(ph + 1) + curl * 0.6) * -sx, 0)
        rf.rot(J[f"t{k}b"], 18 * amp * sin(ph - 1) + curl, (14 * amp * sin(ph)) * sx + curl * -sx, 0)


def float_(i, n):
    t = i / n
    rf.rot(J["ringA"], 0, 0, 60 * t)       # 6 contas => período de 60 graus: loop perfeito
    rf.rot(J["ringB"], 0, 0, -60 * t)
    rf.rot(J["body"], 3 * sin(2 * pi * t), 0, 0)
    tent(t)


def charging(i, n):
    k = (i + 1) / n
    rf.rot(J["ringA"], 0, 0, 20 * k)
    rf.rot(J["ringB"], 0, 0, -20 * k)
    rf.rot(J["ringAt"], -40 * k, 0, -10 * k)   # anéis se alinham na direção do tiro
    rf.rot(J["ringBt"], 36 * k, 0, 16 * k)
    s = 1 - 0.14 * k
    J["ringB"].scale = (s, s, s)
    J["iris"].scale = (1 + 0.45 * k, 1, 1 + 0.45 * k)
    J["body"].scale = (1 + 0.06 * k, 1 - 0.05 * k, 1 + 0.06 * k)
    tent(0.2 * i, 34 * k, 0.4)


ANIMS = [("float", 4, float_), ("charging", 3, charging)]
if PREVIEW:
    rf.preview(rf.TMP + "/shooter_prev.png", J["root"], [lambda: float_(0, 4), lambda: float_(2, 4), lambda: charging(0, 3), lambda: charging(2, 3)], 320, 2.9, 0.92)
else:
    rf.sheet(rf.OUT + "/enemy_shooter.png", J["root"], ANIMS, 256, 256, 2.9, 0.92)
