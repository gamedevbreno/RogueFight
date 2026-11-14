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
T = rf.TILT


def stone(name, top, side, shadow):
    # faces iluminadas (topo e frente) pegam `top`; chanfros e faces opostas à luz pegam `side`/`shadow`
    return rf.toon(name, top, side, rf.mix(top, "#ffffff", 0.12), t1=0.3, t2=0.75)


# THEME é definido por arena_fire.py antes de executar este arquivo; o padrão é a arena arcana.
THEME = globals().get("THEME", "arcane")
PREFIX = "arena_fire_" if THEME == "fire" else "arena_"
PAL = {
    "arcane": dict(
        a=("#2c2356", "#191236", "#0c081c"), b=("#251d49", "#150f2e", "#0a0718"), c=("#34296a", "#1d1540", "#0e0922"),
        cap=("#4a3a9a", "#2c2068", "#150e33"), grout="#08050f", rune="#7a5cff", runeDim="#4a3aa8",
        floorRune="#3b2d86", floorRune2="#2c2266", crack="#08050f", crystal=("#9d7bff", "#5a3ad6", "#e6dcff"),
    ),
    # Cratera vulcânica: basalto escuro, rachaduras de magma, runas e cristais em brasa
    "fire": dict(
        a=("#322a2c", "#1a1416", "#0a0708"), b=("#2a2224", "#151012", "#080607"), c=("#3c3032", "#1e1719", "#0c090a"),
        cap=("#6a4034", "#3a221c", "#190f0c"), grout="#070405", rune="#ff6a14", runeDim="#b8400c",
        floorRune="#b0380c", floorRune2="#6e2408", crack="#7a280a", crystal=("#ff8a2a", "#c2410c", "#ffe08a"),
    ),
}[THEME]


def mats():
    return dict(
        a=stone("sa", *PAL["a"]), b=stone("sb", *PAL["b"]), c=stone("sc", *PAL["c"]), cap=stone("cap", *PAL["cap"]),
        grout=rf.glow("grout", PAL["grout"]),
        rune=rf.glow("rune", PAL["rune"]),
        runeDim=rf.glow("runeDim", PAL["runeDim"]),
        floorRune=rf.glow("floorRune", PAL["floorRune"]),
        floorRune2=rf.glow("floorRune2", PAL["floorRune2"]),
        crack=rf.glow("crack", PAL["crack"]),
        crystal=rf.toon("crystal", *PAL["crystal"]),
    )


# =============================================================== PISO (tile repetível 8x8 unidades)
rf.reset()
M = mats()
rf.mk("grout", B().box((0, 0, -0.05), (30, 30, 0.1)), M["grout"], outline=0, smooth=False)
LAYOUT = ["AshC", "hRAs", "CAsh", "shCA"]
order = ["a", "b", "c"]
k = 0
for row in range(4):
    for col in range(4):
        cx, cy = -3 + col * 2, 3 - row * 2
        t = LAYOUT[row][col]
        k += 1
        if t in "ACR":
            m = M["a" if t == "A" else "c"]
            rf.mk(f"s{k}", B().box((cx, cy, 0.03), (1.88, 1.88, 0.06)), m, outline=0, smooth=False, bevel=0.035)
            if (t == "A" and (row + col) % 2 == 0) or THEME == "fire":   # rachaduras
                ca = 28 + 53 * k          # cada laje racha num ângulo diferente
                rf.mk(f"cr{k}", B().box((cx - 0.25 + 0.1 * (k % 3), cy + 0.15 - 0.1 * (k % 2), 0.062), (0.95, 0.04, 0.01), rot=("Z", ca))
                      .box((cx + 0.2 - 0.12 * (k % 2), cy - 0.05 + 0.1 * (k % 3), 0.062), (0.5, 0.032, 0.01), rot=("Z", ca - 68)), M["crack"], outline=0)
            if t == "R" and THEME != "fire":         # círculo rúnico gravado (na cratera pareceria um telegraph)
                rf.mk("ring", B().torus(0.62, 0.035, seg=40, c=(cx, cy, 0.062)), M["floorRune"], outline=0)
                rf.mk("ring2", B().torus(0.36, 0.022, seg=32, c=(cx, cy, 0.062)), M["floorRune2"], outline=0)
                g = B().box((cx, cy, 0.062), (0.2, 0.2, 0.02), rot=("Z", 45))
                for a in range(4):
                    g.box((cx + 0.49 * cos(a * pi / 2 + pi / 4), cy + 0.49 * sin(a * pi / 2 + pi / 4), 0.062), (0.16, 0.045, 0.02), rot=("Z", 45 + 90 * a))
                rf.mk("glyph", g, M["floorRune"], outline=0)
        elif t == "s":
            for i, (dx, dy) in enumerate(((-0.5, 0.5), (0.5, 0.5), (-0.5, -0.5), (0.5, -0.5))):
                rf.mk(f"s{k}{i}", B().box((cx + dx, cy + dy, 0.02 + 0.012 * ((i + k) % 3)), (0.88, 0.88, 0.05 + 0.024 * ((i + k) % 3))),
                      M[order[(i + k) % 3]], outline=0, smooth=False, bevel=0.03)
        else:
            for i, dy in enumerate((0.5, -0.5)):
                rf.mk(f"s{k}{i}", B().box((cx, cy + dy, 0.025 + 0.015 * i), (1.88, 0.88, 0.05 + 0.03 * i)),
                      M[order[(i + k) % 3]], outline=0, smooth=False, bevel=0.03)
rf.still(rf.OUT + "/" + PREFIX + "tile.png", 800, 528, 8.0)

# =============================================================== PAREDE NORTE + BORDA SUL
def wall_blocks(y_front, rows, mats_, depth=0.07):
    n = 0
    for z0, z1, off in rows:
        for i in range(-7, 8):
            n += 1
            x = i * 1.0 + off
            rf.mk(f"b{n}", B().box((x, y_front + 0.2, (z0 + z1) / 2), (0.94, 0.4 + depth * 2, z1 - z0 - 0.05)),
                  mats_[(i + int(off * 2)) % 2], outline=0, smooth=False, bevel=0.03)


rf.reset()
M = mats()
rf.mk("core", B().box((0, 0.35, 0.75), (30, 0.6, 1.5)), M["grout"], outline=0, smooth=False)
rf.mk("floor", B().box((0, 0, -0.05), (30, 30, 0.1)), M["grout"], outline=0, smooth=False)
wall_blocks(-0.05, [(0.0, 0.44, 0.0), (0.44, 0.86, 0.5)], [M["a"], M["c"]])
rf.mk("band", B().box((0, 0.33, 1.04), (30, 0.62, 0.36)), M["b"], outline=0, smooth=False)
gl = B()
for i in range(-7, 8):
    x = i * 1.0 + 0.5
    kind = i % 4
    if kind == 0:
        gl.box((x, 0.0, 1.04), (0.17, 0.04, 0.17), rot=("Y", 45))
    elif kind == 1:
        gl.box((x - 0.08, 0.0, 1.04), (0.045, 0.04, 0.24)).box((x + 0.08, 0.0, 1.04), (0.045, 0.04, 0.24))
    elif kind == 2:
        gl.box((x, 0.0, 1.1), (0.24, 0.04, 0.045)).box((x, 0.0, 0.99), (0.045, 0.04, 0.18))
    else:
        gl.box((x, 0.0, 1.04), (0.22, 0.04, 0.045), rot=("Y", 45)).box((x, 0.0, 1.04), (0.22, 0.04, 0.045), rot=("Y", -45))
rf.mk("glyphs", gl, M["rune"], outline=0, smooth=False)
rf.mk("cap", B().box((0, 0.28, 1.36), (30, 0.82, 0.24)), M["cap"], outline=0, smooth=False, bevel=0.04)
rf.mk("capline", B().box((0, -0.135, 1.27), (30, 0.02, 0.03)), M["rune"], outline=0, smooth=False)
ext = 4 * 160 / 400
rf.still(rf.TMP + "/wall_n.png", 400, 160, 4.0, ty=-0.12 + (ext / 2) / T)

rf.reset()
M = mats()
rf.mk("curb", B().box((0, -0.15, 0.11), (30, 0.3, 0.22)), M["cap"], outline=0, smooth=False, bevel=0.03)
rf.mk("face", B().box((0, 0.1, -0.75), (30, 0.6, 1.5)), M["grout"], outline=0, smooth=False)
wall_blocks(-0.3, [(-0.46, -0.02, 0.5), (-0.9, -0.46, 0.0), (-1.34, -0.9, 0.5)], [M["b"], M["a"]], depth=0.03)
rf.mk("line", B().box((0, -0.335, -0.03), (30, 0.02, 0.03)), M["rune"], outline=0, smooth=False)
ext = 4 * 128 / 400
ty = (0.22 * rf.SIN - ext / 2) / T          # topo da imagem = aresta traseira do meio-fio
rf.still(rf.TMP + "/wall_s.png", 400, 128, 4.0, ty=ty)
print("ground line px from top (south):", (ext / 2 - (0 - ty) * T) * 100)

# junta norte (em cima) e sul (embaixo) em arena_wall.png
import numpy as np
n = rf._load(rf.TMP + "/wall_n.png"); s = rf._load(rf.TMP + "/wall_s.png")
big = np.zeros((288, 400, 4), dtype=np.float32)
big[128:288] = n          # linha 0 do Blender é a de baixo: norte fica no topo da imagem
big[0:128] = s
rf._save(big, rf.OUT + "/" + PREFIX + "wall.png")
print("OK", PREFIX + "wall.png 400x288 (norte y=0..160, sul y=160..288)")

# =============================================================== PILAR RÚNICO
rf.reset()
M = mats()
rf.mk("base", B().box((0, 0, 0.15), (1.1, 1.1, 0.3), rot=("Z", 45)), M["a"], smooth=False, bevel=0.04)
rf.mk("plinth", B().box((0, 0, 0.38), (0.86, 0.86, 0.16), rot=("Z", 45)), M["c"], smooth=False, bevel=0.03)
rf.mk("shaft", B().cone((0, 0, 0.44), (0, 0, 2.5), 0.46, 0.33, seg=4), M["c"], smooth=False)
for z, R in ((0.95, 0.455), (1.55, 0.415), (2.15, 0.375)):
    rf.mk(f"r{z}", B().torus(R, 0.03, seg=4, ring=6, c=(0, 0, z)), M["rune"], outline=0, smooth=False)
gl = B()
for z in (1.25, 1.85):
    for sx in (1, -1):
        gl.box((0.21 * sx, -0.21, z), (0.2, 0.03, 0.05), rot=("Z", 45 * sx))
        gl.box((0.21 * sx, -0.21, z - 0.12), (0.05, 0.03, 0.14), rot=("Z", 45 * sx))
rf.mk("glyph", gl, M["rune"], outline=0, smooth=False)
rf.mk("capital", B().box((0, 0, 2.6), (0.92, 0.92, 0.2), rot=("Z", 45)), M["cap"], smooth=False, bevel=0.04)
rf.mk("crystal", B().cone((0, 0, 3.12), (0, 0, 3.62), 0.2, 0, seg=4).cone((0, 0, 3.12), (0, 0, 2.84), 0.2, 0, seg=4), M["crystal"], smooth=False)
rf.still(rf.OUT + "/" + PREFIX + "pillar.png", 256, 384, 4.8, tz=1.55)
print("pillar anchor:", 128, 192 + 1.55 * rf.SIN * 80)
