/**
 * Sprites pré-renderizados no Blender (toon/cel-shading, câmera ortográfica a 48,7°,
 * a mesma inclinação de TILT). Os scripts geradores ficam em /blender.
 *
 * Cada spritesheet é uma grade de células: colunas = frames, linhas = animações.
 * O bloco de linhas se repete para cada um dos 5 grupos de direção:
 *   dir 0 Leste · 1 Sudeste · 2 Sul (frente) · 3 Nordeste · 4 Norte (costas)
 * Oeste, Sudoeste e Noroeste são os grupos 0, 1 e 3 espelhados => 8 direções reais.
 */
export interface Facing {
  dir: number; // grupo de direção 0..4
  flip: boolean; // espelhar no eixo X
}

/** Índice = octante + 4, com o octante indo de -4 (Oeste) a 4 (Oeste), 0 = Leste, 2 = Sul. */
const FACINGS: Facing[] = [
  { dir: 0, flip: true }, // -180° Oeste
  { dir: 3, flip: true }, // -135° Noroeste
  { dir: 4, flip: false }, // -90° Norte
  { dir: 3, flip: false }, // -45° Nordeste
  { dir: 0, flip: false }, // 0° Leste
  { dir: 1, flip: false }, // 45° Sudeste
  { dir: 2, flip: false }, // 90° Sul
  { dir: 1, flip: true }, // 135° Sudoeste
  { dir: 0, flip: true }, // 180° Oeste
];

/**
 * Converte um ângulo do mundo (radianos, 0 = +X, sentido horário na tela pois Y cresce
 * para baixo) na direção de sprite mais próxima entre as 8, a cada 45°.
 */
export function facing(ang: number): Facing {
  const a = Math.atan2(Math.sin(ang), Math.cos(ang)); // normaliza para (-PI, PI]
  return FACINGS[Math.round(a / (Math.PI / 4)) + 4];
}

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
  /** Quantidade de animações = altura (em linhas) de cada grupo de direção. */
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
   * Célula da sheet pintada de uma cor sólida, preservando o alpha.
   * Usada no flash branco de dano/telegraph e nas silhuetas dos rastros.
   * O cache é por célula: só os frames realmente usados ocupam memória.
   */
  mask(color: string, sx: number, sy: number): HTMLCanvasElement {
    const key = `${color}|${sx}|${sy}`;
    let c = this.masks.get(key);
    if (!c) {
      const { cw, ch } = this.def;
      c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const g = c.getContext('2d')!;
      g.drawImage(this.img, sx, sy, cw, ch, 0, 0, cw, ch);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, cw, ch);
      this.masks.set(key, c);
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
    file: 'player_mage.png', cw: 256, ch: 256, ax: 128, ay: 197.1, scale: 0.71,
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
  bomber: new Sheet({
    file: 'enemy_bomber.png', cw: 256, ch: 256, ax: 128, ay: 169.2, scale: 0.55,
    anims: { walk: { row: 0, frames: 4 }, throw: { row: 1, frames: 3 } },
  }),
  hellhound: new Sheet({
    file: 'enemy_hellhound.png', cw: 256, ch: 256, ax: 128, ay: 147.7, scale: 0.76,
    anims: { chase: { row: 0, frames: 4 }, windup: { row: 1, frames: 2 }, lunge: { row: 2, frames: 2 } },
  }),
  pyromancer: new Sheet({
    file: 'enemy_pyromancer.png', cw: 256, ch: 256, ax: 128, ay: 204.9, scale: 0.72,
    anims: { float: { row: 0, frames: 4 }, charging: { row: 1, frames: 3 } },
  }),
  brute: new Sheet({
    file: 'enemy_brute.png', cw: 320, ch: 320, ax: 160, ay: 220.1, scale: 0.72,
    anims: { walk: { row: 0, frames: 4 }, pound: { row: 1, frames: 3 } },
  }),
  fireboss: new Sheet({
    file: 'enemy_fireboss.png', cw: 384, ch: 384, ax: 192, ay: 272.6, scale: 0.95,
    anims: { walk: { row: 0, frames: 4 }, wave: { row: 1, frames: 3 }, cast: { row: 2, frames: 3 } },
  }),
  boss: new Sheet({
    file: 'enemy_boss.png', cw: 384, ch: 384, ax: 192, ay: 262.3, scale: 1.15,
    anims: { walk: { row: 0, frames: 4 }, slash: { row: 1, frames: 4 }, cast: { row: 2, frames: 3 }, slam: { row: 3, frames: 4 } },
  }),
  /** Espada vista de cima apontando para +X; âncora no punho. Desenhada no plano do chão. */
  sword: still('weapon_blade.png', 256, 80, 22.6, 40),
  /** Piso repetível: 800x528 px = 400x400 unidades de chão (já achatado por TILT). */
  tile: still('arena_tile.png', 800, 528),
  /** Parede norte em y=0..160 e borda sul em y=160..288; ambas repetem a cada 200 unidades. */
  wall: still('arena_wall.png', 400, 288),
  pillar: still('arena_pillar.png', 256, 384, 128, 285.2, 0.625),
  /** Arena da Fase 2 (cratera vulcânica): mesmas medidas da arena arcana. */
  fireTile: still('arena_fire_tile.png', 800, 528),
  fireWall: still('arena_fire_wall.png', 400, 288),
  firePillar: still('arena_fire_pillar.png', 256, 384, 128, 285.2, 0.625),
};

export function loadSprites(): Promise<void> {
  return Promise.all(Object.values(SHEETS).map((s) => s.load())).then(() => undefined);
}
