import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import rf

importlib.reload(rf)
import bpy
B = rf.B

rf.reset()
steel = rf.toon("steel", "#4a4460", "#1c1828", "#8a82a8")
gold = rf.toon("goldT", "#e0a020", "#8a5a0c", "#ffd870")
wood = rf.toon("wood", "#5a3a26", "#2a1810", "#80583a")
core = rf.glow("core", "#ffb830")

# Martelo de guerra visto de cima, apontando para +X, punho na origem.
# O jogo desenha com Renderer.flat girando no arco do golpe (igual à espada: sword.py).
rf.mk("grip", B().cone((0.0, 0, 0), (0.74, 0, 0), 0.04, 0.04).sphere((-0.02, 0, 0), 0.06), wood, outline=0.028)
rf.mk("bands", B().cone((0.2, 0, 0), (0.25, 0, 0), 0.05, 0.05).cone((0.46, 0, 0), (0.51, 0, 0), 0.05, 0.05), gold, outline=0)
rf.mk("head", B().box((0.9, 0, 0), (0.3, 0.56, 0.3)), steel, outline=0.03, bevel=0.04, smooth=False)
rf.mk("faces", B().box((0.9, 0.29, 0), (0.34, 0.07, 0.34)).box((0.9, -0.29, 0), (0.34, 0.07, 0.34)), gold, outline=0.03, bevel=0.02, smooth=False)
rf.mk("rune", B().box((0.9, 0, 0.16), (0.14, 0.34, 0.03)).box((0.9, 0, 0.16), (0.26, 0.08, 0.03)), core, outline=0)
rf.mk("spike", B().cone((1.04, 0, 0), (1.2, 0, 0), 0.07, 0, seg=6), gold, outline=0.028)
for o in bpy.data.objects:
    if o.type == "MESH":
        o.location.x -= 0.56
# 256x128 px, 188 px/unidade: punho em x = 22.6 px, ponta em x = 248 px
rf.still(rf.OUT + "/weapon_hammer.png", 256, 128, 1.36, top_down=True)
