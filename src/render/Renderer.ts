import { TAU } from '../core/math';
import { ARENA, TILT, VIEW_H } from '../game/config';
import { SHEETS, type Sheet } from './Sprites';

export interface SpriteOpts {
  flip?: boolean; // espelha no eixo X (personagem olhando para a esquerda)
  dir?: number; // grupo de direção 0..4 (use facing(ang) de Sprites.ts)
  tint?: string; // desenha a silhueta em cor sólida (flash branco, rastros)
  alpha?: number;
  add?: boolean; // mistura aditiva (brilho)
  scale?: number;
}

/**
 * Renderer 2.5D: o mundo é um plano (x, y) com altura simulada z.
 *   telaX = x - camX
 *   telaY = (y - camY) * TILT - z
 * Sombras são desenhadas em z=0, o que torna a altura legível.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  w = 1280;
  h = VIEW_H;
  scale = 1;
  camX = 0;
  camY = 0;
  shakeX = 0;
  shakeY = 0;
  /** Tema da arena: 0 = Ruínas Arcanas, 1 = Cratera Vulcânica. */
  theme = 0;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.scale = ch / VIEW_H;
    this.w = cw / this.scale;
  }

  begin(): void {
    const k = this.dpr * this.scale;
    const ctx = this.ctx;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#06040c';
    ctx.fillRect(0, 0, this.w, this.h);
  }

  X(x: number): number {
    return x - this.camX + this.w / 2 + this.shakeX;
  }

  Y(y: number, z = 0): number {
    return (y - this.camY) * TILT + this.h / 2 - z + this.shakeY;
  }

  /** Pixel CSS -> ponto no chão do mundo (z = 0). */
  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    const lx = cssX / this.scale;
    const ly = cssY / this.scale;
    return { x: lx - this.w / 2 + this.camX, y: (ly - this.h / 2) / TILT + this.camY };
  }

  /** Círculo deitado no chão (vira elipse na tela). */
  ellipse(x: number, y: number, z: number, rad: number, fill: string | null, stroke?: string, lw = 2): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(this.X(x), this.Y(y, z), Math.max(0, rad), Math.max(0, rad * TILT), 0, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  /** Círculo voltado para a câmera (esferas, orbes, cabeças). */
  disc(x: number, y: number, z: number, rad: number, fill: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(y, z), Math.max(0, rad), 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  glow(x: number, y: number, z: number, rad: number, color: string, alpha = 0.35): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    this.disc(x, y, z, rad, color);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Sombra projetada no chão; encolhe e clareia conforme a altura. */
  shadow(x: number, y: number, rad: number, z = 0): void {
    const k = 1 / (1 + z / 110);
    this.ellipse(x, y, 0, rad * (0.55 + 0.45 * k), `rgba(0,0,0,${0.5 * k + 0.12})`);
  }

  /** Prisma retangular: face de cima + face frontal. */
  box(x: number, y: number, z: number, hw: number, hd: number, h: number, top: string, front: string): void {
    const ctx = this.ctx;
    const x0 = this.X(x - hw);
    const yTopBack = this.Y(y - hd, z + h);
    const yTopFront = this.Y(y + hd, z + h);
    const yBottom = this.Y(y + hd, z);
    ctx.fillStyle = front;
    ctx.fillRect(x0, yTopFront, hw * 2, yBottom - yTopFront);
    ctx.fillStyle = top;
    ctx.fillRect(x0, yTopBack, hw * 2, yTopFront - yTopBack);
  }

  /** Polígono a partir de triplas (x, y, z) do mundo. */
  poly(pts: number[], fill: string | null, stroke?: string | null, lw = 2): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 3) {
      const sx = this.X(pts[i]);
      const sy = this.Y(pts[i + 1], pts[i + 2]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: string, lw = 2): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.X(x1), this.Y(y1, z1));
    ctx.lineTo(this.X(x2), this.Y(y2, z2));
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /**
   * Desenha um frame de spritesheet com a âncora (pés) em (x, y, z) do mundo.
   * `frame` é limitado ao intervalo da animação; quem chama faz o módulo em loops.
   */
  sprite(s: Sheet, anim: string, frame: number, x: number, y: number, z: number, o: SpriteOpts = {}): void {
    if (!s.ready) return;
    const d = s.def;
    const a = d.anims[anim];
    const f = Math.max(0, Math.min(a.frames - 1, Math.floor(frame)));
    const row = a.row + (o.dir ?? 0) * s.rows;
    const k = d.scale * (o.scale ?? 1);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.X(x), this.Y(y, z));
    ctx.scale(o.flip ? -k : k, k);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    if (o.tint) ctx.drawImage(s.mask(o.tint, f * d.cw, row * d.ch), -d.ax, -d.ay);
    else ctx.drawImage(s.img, f * d.cw, row * d.ch, d.cw, d.ch, -d.ax, -d.ay, d.cw, d.ch);
    ctx.restore();
  }

  /** Imagem inteira (sem animação) ancorada em (x, y, z). */
  image(s: Sheet, x: number, y: number, z = 0): void {
    if (!s.ready) return;
    const d = s.def;
    this.ctx.drawImage(s.img, this.X(x) - d.ax * d.scale, this.Y(y, z) - d.ay * d.scale, d.cw * d.scale, d.ch * d.scale);
  }

  /**
   * Sprite "deitado" no plano horizontal em altura z e girado por `ang` no mundo
   * (a espada): o TILT entra na matriz, então o giro acompanha a perspectiva do chão.
   */
  flat(s: Sheet, x: number, y: number, z: number, ang: number, len: number): void {
    if (!s.ready) return;
    const d = s.def;
    const k = len / (d.cw - d.ax - 45); // 45 px de folga após a ponta
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.X(x), this.Y(y, z));
    ctx.scale(1, TILT);
    ctx.rotate(ang);
    const wide = 1.5; // engrossa a lâmina: ela ficaria fina demais depois do achatamento do TILT
    ctx.drawImage(s.img, -d.ax * k, -d.ay * k * wide, d.cw * k, d.ch * k * wide);
    ctx.restore();
  }

  /** Piso, parede norte e pilares do fundo: tudo que fica ATRÁS das entidades. */
  drawArena(t: number): void {
    const ctx = this.ctx;
    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    const x0 = this.X(-hw);
    const x1 = this.X(hw);
    const y0 = this.Y(-hh);
    const y1 = this.Y(hh);

    // piso: tile de 400x400 unidades, recortado no retângulo da arena
    const tile = this.theme ? SHEETS.fireTile : SHEETS.tile;
    if (tile.ready) {
      const TW = 400;
      const TH = 400 * TILT;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      for (let i = 0; i * TW < ARENA.w; i++) {
        for (let j = 0; j * 400 < ARENA.h; j++) {
          const tx = x0 + i * TW;
          const ty = y0 + j * TH;
          if (tx > this.w || tx + TW < 0 || ty > this.h || ty + TH < 0) continue; // fora da tela
          ctx.drawImage(tile.img, tx, ty, TW + 0.5, TH + 0.5);
        }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#1a1335';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    // laterais: a câmera vê essas paredes de perfil, então viram frisos
    ctx.fillStyle = this.theme ? '#1c1210' : '#150e33';
    ctx.fillRect(x0 - 14, y0, 14, y1 - y0);
    ctx.fillRect(x1, y0, 14, y1 - y0);

    // parede norte (repete a cada 200 unidades)
    const wall = this.theme ? SHEETS.fireWall : SHEETS.wall;
    if (wall.ready) {
      for (let i = 0; i * 200 < ARENA.w; i++) {
        ctx.drawImage(wall.img, 0, 0, 400, 160, x0 + i * 200, y0 - 78, 200.5, 80);
      }
    } else {
      ctx.fillStyle = '#241a4d';
      ctx.fillRect(x0, y0 - 80, x1 - x0, 80);
    }

    ctx.strokeStyle = this.theme ? 'rgba(255,110,40,0.75)' : 'rgba(122,92,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    const back = [[-hw - 34, -hh + 8], [hw + 34, -hh + 8], [-300, -hh - 4], [300, -hh - 4], [-hw - 34, 0], [hw + 34, 0]];
    for (const [px, py] of back) this.pillar(px, py, t);
  }

  /** Borda sul e pilares da frente: desenhados DEPOIS das entidades (ficam por cima). */
  drawArenaFront(t: number): void {
    const ctx = this.ctx;
    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    const x0 = this.X(-hw);
    const y1 = this.Y(hh);
    const wall = this.theme ? SHEETS.fireWall : SHEETS.wall;
    if (wall.ready) {
      for (let i = 0; i * 200 < ARENA.w; i++) {
        ctx.drawImage(wall.img, 0, 160, 400, 128, x0 + i * 200, y1 - 8.3, 200.5, 64);
      }
    } else {
      ctx.fillStyle = '#0d0820';
      ctx.fillRect(x0, y1, ARENA.w, 56);
    }
    // a face da plataforma some na escuridão
    const g = ctx.createLinearGradient(0, y1 + 8, 0, y1 + 58);
    g.addColorStop(0, 'rgba(6,4,12,0)');
    g.addColorStop(1, 'rgba(6,4,12,1)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 20, y1 + 8, ARENA.w + 40, 52);
    this.pillar(-hw - 34, hh + 6, t);
    this.pillar(hw + 34, hh + 6, t);
  }

  private pillar(x: number, y: number, t: number): void {
    this.shadow(x, y, 44);
    this.image(this.theme ? SHEETS.firePillar : SHEETS.pillar, x, y);
    // cristal do topo pulsa
    this.glow(x, y, 124, 13 + 4 * Math.sin(t * 2.2 + x * 0.01), this.theme ? '#ff8a2a' : '#9d7bff', 0.4);
  }
}
