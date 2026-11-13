import { TAU } from '../core/math';
import { ARENA, TILT, VIEW_H } from '../game/config';

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

  drawArena(): void {
    const ctx = this.ctx;
    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    const x0 = this.X(-hw);
    const x1 = this.X(hw);
    const y0 = this.Y(-hh);
    const y1 = this.Y(hh);
    const T = 100;

    // face frontal da plataforma (dá volume ao chão)
    ctx.fillStyle = '#0d0820';
    ctx.fillRect(x0, y1, x1 - x0, 54);
    ctx.fillStyle = '#3b2a8a';
    ctx.fillRect(x0, y1, x1 - x0, 3);

    // piso xadrez
    for (let i = 0; i < ARENA.w / T; i++) {
      for (let j = 0; j < ARENA.h / T; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#150f2b' : '#1a1335';
        const tx = this.X(-hw + i * T);
        const ty = this.Y(-hh + j * T);
        ctx.fillRect(tx, ty, T + 0.5, T * TILT + 0.5);
      }
    }

    // parede do fundo
    ctx.fillStyle = '#241a4d';
    ctx.fillRect(x0, y0 - 80, x1 - x0, 80);
    ctx.fillStyle = '#35277a';
    ctx.fillRect(x0, y0 - 80, x1 - x0, 6);

    // borda neon
    ctx.strokeStyle = '#7a5cff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
}
