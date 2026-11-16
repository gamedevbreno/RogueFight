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
armor = rf.toon("armor", "#4a4460", "#1c1828", "#746c90")
steel = rf.toon("steel", "#4a4460", "#1c1828", "#8a82a8")
gold = rf.toon("goldT", "#e0a020", "#8a5a0c", "#ffd870")
wood = rf.toon("wood", "#5a3a26", "#2a1810", "#80583a")
core = rf.glow("core", "#ffb830")

root = rf.joint("root", None, (0, 0, 0))
tilt = rf.joint("tilt", root, (0, 0, 0), rot0=(20, 0, 0))

# Martelo de guerra 3D volumétrico: punho em (0, 0, 0), cabeça apontando para +X.
rf.mk("hand", B().sphere((0, 0, 0), 0.088), armor, tilt, outline=0.026)
rf.mk("cuff", B().cone((-0.12, 0, 0), (-0.07, 0, 0), 0.082, 0.088), gold, tilt, outline=0)
rf.mk("grip", B().cone((-0.16, 0, 0), (0.76, 0, 0), 0.052, 0.058), wood, tilt, outline=0.028)
rf.mk("pommel", B().sphere((-0.18, 0, 0), 0.082), gold, tilt, outline=0.026)
rf.mk("bands",
      B().cone((0.18, 0, 0), (0.24, 0, 0), 0.064, 0.064)
      .cone((0.46, 0, 0), (0.52, 0, 0), 0.066, 0.066),
      gold, tilt, outline=0)

rf.mk("head", B().box((0.88, 0, 0), (0.36, 0.54, 0.38)), steel, tilt, outline=0.03, bevel=0.04, smooth=False)
rf.mk("faces",
      B().box((0.88, 0.31, 0), (0.40, 0.11, 0.42))
      .box((0.88, -0.31, 0), (0.40, 0.11, 0.42)),
      gold, tilt, outline=0.03, bevel=0.025, smooth=False)
rf.mk("caps",
      B().box((0.88, 0, 0.20), (0.28, 0.44, 0.06))
      .box((0.88, 0, -0.20), (0.28, 0.44, 0.06)),
      gold, tilt, outline=0.024, bevel=0.015, smooth=False)
rf.mk("rune",
      B().box((0.88, 0, 0.235), (0.14, 0.32, 0.03))
      .box((0.88, 0, 0.235), (0.24, 0.09, 0.03))
      .box((0.88, 0, -0.235), (0.14, 0.32, 0.03))
      .box((0.88, 0, -0.235), (0.24, 0.09, 0.03))
      .box((1.065, 0, 0), (0.03, 0.30, 0.10))
      .box((1.065, 0, 0), (0.03, 0.09, 0.24))
      .box((0.695, 0, 0), (0.03, 0.30, 0.10))
      .box((0.695, 0, 0), (0.03, 0.09, 0.24)),
      core, tilt, outline=0)
rf.mk("spike", B().cone((1.05, 0, 0), (1.26, 0, 0), 0.095, 0, seg=6), gold, tilt, outline=0.028)

CELL = 224
COLS, ROWS = 6, 4
ORTHO = 2.8
os.makedirs(rf.TMP, exist_ok=True)
out_path = os.path.join(rf.TMP, "hammer_prev.png") if PREVIEW else os.path.join(rf.OUT, "weapon_hammer.png")
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
