"""Compacta as spritesheets de personagens (Python do sistema + Pillow, fora do Blender).

    python blender/optimize.py

O cel-shading usa poucas cores chapadas, então reduzir cada sheet a uma paleta de
256 cores RGBA corta o tamanho em várias vezes sem diferença visível. Rode depois
de renderizar; é seguro rodar de novo (arquivos já em paleta são ignorados).
"""
import os
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "sprites")
Image.MAX_IMAGE_PIXELS = None



def save(im, path):
    """Grava em arquivo temporário e troca; tenta de novo se o OneDrive/antivírus travar o destino."""
    tmp = path + ".tmp"
    im.save(tmp, format="PNG", optimize=True)
    for attempt in range(10):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            time.sleep(0.5)
    raise SystemExit(f"não consegui gravar {path}")


total_before = total_after = 0
for name in sorted(os.listdir(OUT)):
    if not name.endswith(".png"):
        continue
    path = os.path.join(OUT, name)
    before = os.path.getsize(path)
    with Image.open(path) as src:
        im = src.copy()   # carrega tudo e libera o arquivo antes de regravar
    if im.mode == "RGBA" and name.startswith(("player_", "enemy_")):
        save(im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE), path)
    elif im.mode != "P":
        save(im, path)
    after = os.path.getsize(path)
    total_before += before
    total_after += after
    print(f"{name:22s} {before / 1024:8.0f} KB -> {after / 1024:7.0f} KB")
print(f"{'total':22s} {total_before / 1024:8.0f} KB -> {total_after / 1024:7.0f} KB")
