/**
 * Sprites pré-renderizados no Blender (toon/cel-shading, câmera ortográfica a 48,7°,
 * a mesma inclinação de TILT). Cada spritesheet é uma grade de células:
 *   colunas = frames, linhas = animações; as linhas se repetem para a vista "norte"
 *   (personagem de costas), logo depois das linhas da vista "sul".
 */
export interface Anim {
  row: number;
  frames: number;
}

export interface SheetDef {
  file: string;
  cw: number; // largura da célula (px)
  ch: number; // altura da célula (px)
  ax: number; // âncora: pixel da célula que corresponde ao ponto (x, y, z=0) do mundo
  ay: number;
  scale: number; // unidades do jogo por pixel do sprite
  anims: Record<string, Anim>;
}

export class Sheet {
  readonly img = new Image();
  ready = false;
  /** Quantidade de animações = deslocamento de linhas até a vista norte. */
  readonly rows: number;
  private readonly masks = new Map<string, HTMLCanvasElement>();

  constructor(readonly def: SheetDef) {
    this.rows = Object.keys(def.anims).length;
  }

  load(): Promise<void> {
    return new Promise((resolve) => {
      this.img.onload = () => {
        this.ready = true;
        resolve();
      };
      this.img.onerror = () => {
        console.warn(`sprite não carregado: ${this.def.file}`);
        resolve();
      };
      // BASE_URL respeita `base: './'` do Vite => funciona em subpasta do GitHub Pages
      this.img.src = `${import.meta.env.BASE_URL}sprites/${this.def.file}`;
    });
  }

  /**
   * Cópia da sheet pintada de uma cor sólida, preservando o alpha.
   * Usada no flash branco de dano/telegraph e nas silhuetas dos rastros.
   */
  mask(color: string): HTMLCanvasElement {
    let c = this.masks.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = this.img.width;
      c.height = this.img.height;
      const g = c.getContext('2d')!;
      g.drawImage(this.img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      this.masks.set(color, c);
    }
    return c;
  }
}

const still = (file: string, cw: number, ch: number, ax = 0, ay = 0, scale = 1): Sheet =>
  new Sheet({ file, cw, ch, ax, ay, scale, anims: {} });

export const SHEETS = {
  blade: new Sheet({
    file: 'player_blade.png', cw: 256, ch: 256, ax: 128, ay: 198.3, scale: 0.63,
    anims: { idle: { row: 0, frames: 4 }, run: { row: 1, frames: 6 }, attack: { row: 2, frames: 4 }, dash: { row: 3, frames: 2 } },
  }),
  mage: new Sheet({
    file: 'player_mage.png', cw: 256, ch: 256, ax: 128, ay: 200.1, scale: 0.62,
    anims: { idle: { row: 0, frames: 4 }, run: { row: 1, frames: 6 }, cast: { row: 2, frames: 3 } },
  }),
  chaser: new Sheet({
    file: 'enemy_chaser.png', cw: 256, ch: 256, ax: 128, ay: 161.2, scale: 0.54,
    anims: { chase: { row: 0, frames: 4 }, windup: { row: 1, frames: 2 }, lunge: { row: 2, frames: 2 } },
  }),
  shooter: new Sheet({
    file: 'enemy_shooter.png', cw: 256, ch: 256, ax: 128, ay: 189, scale: 0.5,
    anims: { float: { row: 0, frames: 4 }, charging: { row: 1, frames: 3 } },
  }),
  tank: new Sheet({
    file: 'enemy_tank.png', cw: 320, ch: 320, ax: 160, ay: 222.7, scale: 0.66,
    anims: { walk: { row: 0, frames: 4 }, leap: { row: 1, frames: 3 }, slam: { row: 2, frames: 3 } },
  }),
  /** Espada vista de cima apontando para +X; âncora no punho. Desenhada no plano do chão. */
  sword: still('weapon_blade.png', 256, 80, 22.6, 40),
  /** Piso repetível: 800x528 px = 400x400 unidades de chão (já achatado por TILT). */
  tile: still('arena_tile.png', 800, 528),
  /** Parede norte em y=0..160 e borda sul em y=160..288; ambas repetem a cada 200 unidades. */
  wall: still('arena_wall.png', 400, 288),
  pillar: still('arena_pillar.png', 256, 384, 128, 285.2, 0.625),
};

export function loadSprites(): Promise<void> {
  return Promise.all(Object.values(SHEETS).map((s) => s.load())).then(() => undefined);
}
