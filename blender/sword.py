import importlib
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import rf

importlib.reload(rf)
PREVIEW = bool(globals().get("PREVIEW")) or "--preview" in sys.argv
B = rf.B

rf.reset()
edge = rf.glow("edge", "#39e6ff")
core = rf.glow("core", "#f2ffff")
metal = rf.toon("metal", "#16607a", "#0b3442", "#3aa3c4")
dark = rf.toon("grip", "#132436", "#070e16")

root = rf.joint("root", None, (0, 0, 0))
tilt = rf.joint("tilt", root, (0, 0, 0), rot0=(32, -16, 0))

# Espada 3D volumétrica: punho na origem (0, 0, 0), lâmina apontando para +X.
rf.mk("hand", B().sphere((0, 0, 0), 0.082), dark, tilt, outline=0.025)
rf.mk("cuff", B().cone((-0.11, 0, 0), (-0.06, 0, 0), 0.072, 0.078), edge, tilt, outline=0)
rf.mk("grip", B().cone((-0.16, 0, 0), (0.14, 0, 0), 0.048, 0.048), dark, tilt, outline=0.028)
rf.mk("pommel", B().sphere((-0.19, 0, 0), 0.075), metal, tilt, outline=0.026)
rf.mk("pommel_gem", B().sphere((-0.24, 0, 0), 0.036), edge, tilt, outline=0)

rf.mk("guard", B().box((0.16, 0, 0), (0.13, 0.50, 0.17)), metal, tilt, outline=0.028, bevel=0.025, smooth=False)
rf.mk("guard_wings",
      B().cone((0.16, 0.22, 0), (0.24, 0.34, 0), 0.07, 0.02, seg=6)
      .cone((0.16, -0.22, 0), (0.24, -0.34, 0), 0.07, 0.02, seg=6),
      metal, tilt, outline=0.025, smooth=False)
rf.mk("guard_gem", B().box((0.17, 0, 0), (0.14, 0.15, 0.21)), edge, tilt, outline=0.018, bevel=0.015, smooth=False)

rf.mk("edge", B().cone((0.20, 0, 0), (1.16, 0, 0), 0.17, 0, seg=4, flat=(0.55, 1.0)), edge, tilt, outline=0.028, smooth=False)
rf.mk("ridge", B().cone((0.20, 0, 0), (0.86, 0, 0), 0.12, 0.015, seg=4, flat=(0.95, 0.55)), metal, tilt, outline=0, smooth=False)
rf.mk("core",
      B().cone((0.22, 0, 0.065), (1.02, 0, 0.01), 0.048, 0, seg=4)
      .cone((0.22, 0, -0.065), (1.02, 0, -0.01), 0.048, 0, seg=4),
      core, tilt, outline=0, smooth=False)

CELL = 192
COLS, ROWS = 6, 4
ORTHO = 2.65
os.makedirs(rf.TMP, exist_ok=True)
out_path = os.path.join(rf.TMP, "sword_prev.png") if PREVIEW else os.path.join(rf.OUT, "weapon_blade.png")
os.makedirs(os.path.dirname(out_path), exist_ok=True)

rf.camera(ORTHO, CELL, CELL, tz=0.0, ty=0.0, top_down=False)
big = np.zeros((ROWS * CELL, COLS * CELL, 4), dtype=np.float32)
warn = []

for k in range(24):
    rf.rest()
    root.rotation_euler = (0, 0, -math.radians(k * 15))
    tmp = os.path.join(rf.TMP, "w_f.png")
    rf.render(tmp)
    a = rf._load(tmp)
    al = a[:, :, 3]
    if al[0].max() > 0.02 or al[-1].max() > 0.02 or al[:, 0].max() > 0.02 or al[:, -1].max() > 0.02:
        warn.append(f"ang={k * 15}")
    col, row = k % COLS, k // COLS
    y0 = (ROWS - 1 - row) * CELL
    big[y0:y0 + CELL, col * CELL:(col + 1) * CELL] = a

rf._save(big, out_path)
px = CELL / ORTHO
print(f"OK {os.path.basename(out_path)} {COLS * CELL}x{ROWS * CELL} cell={CELL}x{CELL} "
      f"px/unit={px:.1f} anchor=({CELL // 2},{CELL // 2})")
print("CORTADO:" if warn else "sem cortes", ", ".join(warn))
