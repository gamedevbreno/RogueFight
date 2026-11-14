import type { Renderer } from '../../render/Renderer';
import { ELEMENTS } from '../config';
import type { World } from '../World';

export type EnemyKind = 'chaser' | 'shooter' | 'tank' | 'bomber' | 'boss';

export interface EnemyCfg {
  hp: number;
  radius: number;
  speed: number;
  color: string;
  knockMul: number; // 1 = knockback total, 0 = imune
  height: number;
}

const SPAWN_T = 0.85;
const MAX_MARKS = 6;

/** Base dos inimigos: status (marcas, queimadura, lentidão), knockback, spawn telegrafado. */
export abstract class Enemy {
  z = 0;
  px: number; py: number; pz = 0;
  rx: number; ry: number; rz = 0;
  kvx = 0; kvy = 0;
  hp: number; maxHp: number;
  flash = 0;
  spawnT = SPAWN_T;
  dead = false;

  /** Marcas elementais (índices em ELEMENTS) aplicadas pelo Arcanista. */
  marks: number[] = [];
  private markT = 0;
  burn = 0; burnT = 0;
  private burnAcc = 0;
  slowT = 0;

  readonly radius: number;
  readonly speed: number;
  readonly color: string;
  readonly knockMul: number;
  readonly height: number;
  /** Barra de vida sobre a cabeça (o Boss usa a barra do HUD). */
  protected showBar = true;

  constructor(public x: number, public y: number, c: EnemyCfg) {
    this.px = this.rx = x;
    this.py = this.ry = y;
    this.hp = this.maxHp = Math.round(c.hp);
    this.radius = c.radius;
    this.speed = c.speed;
    this.color = c.color;
    this.knockMul = c.knockMul;
    this.height = c.height;
  }

  /** Só inimigos ativos podem ser atingidos (não durante o spawn). */
  get active(): boolean {
    return !this.dead && this.spawnT <= 0;
  }

  addMark(el: number): void {
    this.marks.push(el);
    if (this.marks.length > MAX_MARKS) this.marks.shift();
    this.markT = 8;
  }

  update(dt: number, w: World): void {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    if (this.flash > 0) this.flash -= dt;

    if (this.spawnT > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) w.particles.burst(this.x, this.y, 10, 10, this.color, 220);
      return;
    }

    if (this.markT > 0 && (this.markT -= dt) <= 0) this.marks.length = 0;

    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnAcc += this.burn * dt;
      if (Math.random() < dt * 14) w.particles.burst(this.x, this.y, this.height * 0.6, 1, ELEMENTS[0].color, 60, { up: 220, g: -100 });
      if (this.burnAcc >= 2) {
        const d = Math.floor(this.burnAcc);
        this.burnAcc -= d;
        if (w.damageEnemy(this, d, { color: ELEMENTS[0].color })) return;
      }
    }

    let slow = 1;
    if (this.slowT > 0) {
      this.slowT -= dt;
      slow = 0.45;
    }

    if (!w.player.dead) this.ai(dt, w, slow);

    this.x += this.kvx * dt;
    this.y += this.kvy * dt;
    const k = Math.exp(-8 * dt);
    this.kvx *= k;
    this.kvy *= k;
    w.clampArena(this, this.radius);
  }

  /** Chamado uma vez quando o inimigo morre (efeitos especiais de morte). */
  onDeath(_w: World): void {}

  protected abstract ai(dt: number, w: World, slow: number): void;
  protected abstract drawBody(r: Renderer): void;

  interp(a: number): void {
    this.rx = this.px + (this.x - this.px) * a;
    this.ry = this.py + (this.y - this.py) * a;
    this.rz = this.pz + (this.z - this.pz) * a;
  }

  drawGround(r: Renderer): void {
    if (this.spawnT > 0) {
      const u = 1 - this.spawnT / SPAWN_T;
      r.ctx.globalAlpha = 0.35 + 0.5 * u;
      r.ellipse(this.rx, this.ry, 0, this.radius * 1.5, null, this.color, 2);
      r.ellipse(this.rx, this.ry, 0, this.radius * 1.5 * u, this.color);
      r.ctx.globalAlpha = 1;
      return;
    }
    r.shadow(this.rx, this.ry, this.radius * 1.1, this.rz);
    if (this.slowT > 0) r.ellipse(this.rx, this.ry, 0, this.radius * 1.3, null, ELEMENTS[1].color, 2);
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const x = this.rx, y = this.ry;
    if (this.spawnT > 0) {
      const u = 1 - this.spawnT / SPAWN_T;
      ctx.globalAlpha = 0.3 + 0.6 * u;
      r.line(x, y, 0, x, y, this.height * 1.6 * u, this.color, 4);
      ctx.globalAlpha = 1;
      return;
    }

    this.drawBody(r);

    const top = this.rz + this.height + 12;
    if (this.showBar && this.hp < this.maxHp) {
      const w = this.radius * 2;
      const sx = r.X(x) - w / 2, sy = r.Y(y, top);
      ctx.fillStyle = '#000';
      ctx.fillRect(sx - 1, sy - 1, w + 2, 6);
      ctx.fillStyle = this.color;
      ctx.fillRect(sx, sy, w * Math.max(0, this.hp / this.maxHp), 4);
    }
    const n = this.marks.length;
    for (let i = 0; i < n; i++) {
      const mx = x + (i - (n - 1) / 2) * 10;
      r.disc(mx, y, top + 12, 4.5, '#000');
      r.disc(mx, y, top + 12, 3.2, ELEMENTS[this.marks[i]].color);
    }
  }

  protected tint(c: string): string {
    return this.flash > 0 ? '#ffffff' : c;
  }
}
