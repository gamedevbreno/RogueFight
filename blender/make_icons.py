"""Gera os ícones do PWA a partir dos sprites já renderizados (Python do sistema + Pillow).

    python blender/make_icons.py

Saída em public/: icon-192.png, icon-512.png e apple-touch-icon.png (180x180).
Os dois heróis (vista frontal, pose idle) sobre fundo escuro com borda neon.
O conteúdo fica dentro da área segura de 80% para o ícone "maskable" do Android.
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(os.path.dirname(HERE), "public")
SPRITES = os.path.join(PUBLIC, "sprites")
S = 1024  # desenha grande e reduz (antialias)
CELL = 256
FRONT = 2  # grupo de direção Sul (frente)


def hero(sheet, anims):
    """Recorta o frame 0 da animação idle na vista frontal e apara o vazio."""
    im = Image.open(os.path.join(SPRITES, sheet)).convert("RGBA")
    cell = im.crop((0, FRONT * anims * CELL, CELL, (FRONT * anims + 1) * CELL))
    return cell.crop(cell.getbbox())


def glow_line(size, box, radius, color, width, blur):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius, outline=color, width=width)
    return layer.filter(ImageFilter.GaussianBlur(blur))


def build():
    img = Image.new("RGBA", (S, S), "#06040c")
    d = ImageDraw.Draw(img)
    # piso em degradê: do roxo profundo ao quase preto
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(26 - 18 * t), int(16 - 11 * t), int(54 - 38 * t), 255))
    # brilhos nas cores das classes atrás de cada herói
    halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((150, 300, 560, 760), fill=(57, 230, 255, 90))
    hd.ellipse((470, 280, 880, 740), fill=(199, 139, 255, 90))
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(70)))

    # borda neon (ciano por fora, lilás por dentro) com halo desfocado
    m = 46
    img.alpha_composite(glow_line(S, (m, m, S - m, S - m), 150, (57, 230, 255, 255), 26, 22))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((m, m, S - m, S - m), 150, outline="#39e6ff", width=14)
    d.rounded_rectangle((m + 26, m + 26, S - m - 26, S - m - 26), 128, outline="#c78bff", width=6)

    # heróis lado a lado, com sombra no chão
    blade, mage = hero("player_blade.png", 4), hero("player_mage.png", 3)
    for sprite, cx, height in ((blade, 372, 500), (mage, 664, 560)):
        k = height / sprite.height
        sp = sprite.resize((round(sprite.width * k), height), Image.LANCZOS)
        x, y = cx - sp.width // 2, 800 - sp.height
        shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse((cx - 130, 770, cx + 130, 830), fill=(0, 0, 0, 170))
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
        img.alpha_composite(sp, (x, y))
    return img


def main():
    icon = build()
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
        out = icon.resize((size, size), Image.LANCZOS)
        if name.startswith("apple"):
            out = out.convert("RGB")  # o iOS pinta transparência de preto: melhor entregar opaco
        out.save(os.path.join(PUBLIC, name), optimize=True)
        print(f"OK {name} {size}x{size} {os.path.getsize(os.path.join(PUBLIC, name)) // 1024} KB")


if __name__ == "__main__":
    main()
