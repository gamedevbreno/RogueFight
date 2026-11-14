import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import rf

importlib.reload(rf)
PREVIEW = bool(globals().get("PREVIEW")) or "--preview" in sys.argv
B = rf.B
rf.reset()
edge = rf.glow("edge", "#39e6ff"); core = rf.glow("core", "#f2ffff")
metal = rf.toon("metal", "#16607a", "#0b3442", "#3aa3c4"); dark = rf.toon("grip", "#132436", "#070e16")
# espada vista de cima, apontando para +X, punho na origem
rf.mk("edge", B().cone((0.22, 0, 0), (1.0, 0, 0), 0.15, 0, seg=4, flat=(1, 0.3)), edge, outline=0.028, smooth=False)
rf.mk("core", B().cone((0.22, 0, 0.03), (0.9, 0, 0.03), 0.065, 0, seg=4, flat=(1, 0.3)), core, outline=0, smooth=False)
rf.mk("guard", B().box((0.2, 0, 0), (0.07, 0.42, 0.07)), metal, outline=0.028, bevel=0.02)
rf.mk("grip", B().cone((0.02, 0, 0), (0.2, 0, 0), 0.04, 0.04), dark, outline=0.028)
import bpy
for o in bpy.data.objects:
    if o.type == "MESH": o.location.x -= 0.56
rf.still(rf.OUT + "/weapon_blade.png", 256, 80, 1.36, top_down=True)
