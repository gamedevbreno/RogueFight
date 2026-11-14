import type { Renderer } from '../../render/Renderer';
import { ELEMENTS, STATUS } from '../config';
import type { World } from '../World';

export type EnemyKind =
  | 'chaser' | 'shooter' | 'tank' | 'bomber' | 'boss'
  | 'hellhound' | 'pyromancer' | 'brute' | 'fireBoss';

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
const DOT_T = 4; // duração de Veneno e Sangramento
const MAX_POISON = 5;
const BLEED_BURST = 3; // stacks de Sangramento que estouram a Hemorragia

/**
 * Base dos inimigos: knockback, spawn telegrafado e efeitos de status.
 *   Queimadura  dano periódico
 *   Veneno      dano periódico acumulativo (até 5 stacks); o alvo toma +10% de dano
 *   Sangramento dano periódico que dobra se o alvo estiver andando; 3 stacks = Hemorragia
 *   Paralisia   congela IA e movimento
 *   Lentidão    reduz a velocidade
 */
export abstract class Enemy {
  z = 0;
  px: number; py: number; pz = 0;
  rx: number; ry: number; rz = 0;
  kvx = 0; kvy = 0;
  hp: number; maxHp: number;
  flash = 0;
  spawnT = SPAWN_T;
  dead = false;

  /** Preenchido pelos chefes: o HUD mostra a barra de vida de quem tiver nome. */
  bossName: string | null = null;
  enraged = false;

  /** Marcas elementais (índices em ELEMENTS) aplicadas pelo Arcanista. */
  marks: number[] = [];
  private markT = 0;

  burn = 0; burnT = 0;
  poison = 0; poisonT = 0; poisonStacks = 0;
  bleed = 0; bleedT = 0; bleedStacks = 0;
  stunT = 0;
  slowT = 0;
  /** Chefes resistem à Paralisia. */
  protected stunMul = 1;
  private burnAcc = 0;
  private poisonAcc = 0;
  private bleedAcc = 0;
  private moving = false;

  readonly radius: number;
  readonly speed: number;
  readonly color: string;
  readonly knockMul: number;
  readonly height: number;
  /** Barra de vida sobre a cabeça (os chefes usam a barra do HUD). */
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

  // ---------- efeitos de status ----------
  applyBurn(dps: number, t = 3): void {
    this.burn = Math.max(this.burn, dps);
    this.burnT = Math.max(this.burnT, t);
  }

  applyPoison(dpsPerStack: number): void {
    this.poison = Math.max(this.poison, dpsPerStack);
    this.poisonStacks = Math.min(MAX_POISON, this.poisonStacks + 1);
    this.poisonT = DOT_T;
  }

  /** Soma um stack de Sangramento; ao chegar em 3 estoura a Hemorragia (`burst` de dano). */
  applyBleed(w: World, dpsPerStack: number, burst: number): void {
    this.bleed = Math.max(this.bleed, dpsPerStack);
    this.bleedT = DOT_T;
    if (++this.bleedStacks < BLEED_BURST) return;
    this.bleedStacks = 0;
    this.bleedT = 0;
    w.particles.burst(this.x, this.y, this.height * 0.5, 22, STATUS.bleed, 360, { up: 260, size: 6 });
    w.damageEnemy(this, burst, { color: STATUS.bleed, heavy: true });
  }

  /** Stack de Sangramento sem estourar (usado no contágio da Epidemia). */
  addBleedStack(dpsPerStack: number): void {
    this.bleed = Math.max(this.bleed, dpsPerStack);
    this.bleedT = DOT_T;
    this.bleedStacks = Math.min(BLEED_BURST - 1, this.bleedStacks + 1);
  }

  applyStun(t: number): void {
    this.stunT = Math.max(this.stunT, t * this.stunMul);
  }

  /** Quantos efeitos negativos diferentes estão ativos (Torturador, Epidemia). */
  statusCount(): number {
    return (this.burnT > 0 ? 1 : 0) + (this.poisonT > 0 ? 1 : 0) + (this.bleedT > 0 ? 1 : 0) + (this.stunT > 0 ? 1 : 0) + (this.slowT > 0 ? 1 : 0);
  }

  /** Aplica os danos periódicos. Retorna true se o inimigo morreu. */
  private tickDots(dt: number, w: World): boolean {
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnAcc += this.burn * dt;
      if (Math.random() < dt * 14) w.particles.burst(this.x, this.y, this.height * 0.6, 1, STATUS.burn, 60, { up: 220, g: -100 });
      if (this.burnAcc >= 2) {
        const d = Math.floor(this.burnAcc);
        this.burnAcc -= d;
        if (w.damageEnemy(this, d, { color: STATUS.burn, dot: true })) return true;
      }
    }
    if (this.poisonT > 0) {
      this.poisonT -= dt;
      this.poisonAcc += this.poison * this.poisonStacks * dt;
      if (Math.random() < dt * 8) w.particles.burst(this.x, this.y, this.height * 0.4, 1, STATUS.poison, 50, { up: 160, g: -60, size: 5 });
      if (this.poisonAcc >= 2) {
        const d = Math.floor(this.poisonAcc);
        this.poisonAcc -= d;
        if (w.damageEnemy(this, d, { color: STATUS.poison, dot: true })) return true;
      }
      if (this.poisonT <= 0) this.poisonStacks = 0;
    }
    if (this.bleedT > 0) {
      this.bleedT -= dt;
      // sangra o dobro enquanto anda
      this.bleedAcc += this.bleed * this.bleedStacks * (this.moving ? 2 : 1) * dt;
      if (this.moving && Math.random() < dt * 10) w.particles.burst(this.x, this.y, 10, 1, STATUS.bleed, 40, { up: 40, size: 4 });
      if (this.bleedAcc >= 2) {
        const d = Math.floor(this.bleedAcc);
        this.bleedAcc -= d;
        if (w.damageEnemy(this, d, { color: STATUS.bleed, dot: true })) return true;
      }
      if (this.bleedT <= 0) this.bleedStacks = 0;
    }
    return false;
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
    if (this.tickDots(dt, w)) return;

    let slow = 1;
    if (this.slowT > 0) {
      this.slowT -= dt;
      slow = 0.45;
    }

    if (this.stunT > 0) {
      this.stunT -= dt; // paralisado: sem IA, sem movimento próprio
      if (Math.random() < dt * 16) w.particles.burst(this.x, this.y, this.height * 0.8, 1, STATUS.stun, 160, { up: 120, life: 0.25, size: 4 });
    } else if (!w.player.dead) {
      this.ai(dt, w, slow);
    }

    this.x += this.kvx * dt;
    this.y += this.kvy * dt;
    const k = Math.exp(-8 * dt);
    this.kvx *= k;
    this.kvy *= k;
    w.clampArena(this, this.radius);
    this.moving = Math.hypot(this.x - this.px, this.y - this.py) > 20 * dt;
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
    if (this.poisonT > 0) r.ellipse(this.rx, this.ry, 0, this.radius * 1.45, null, STATUS.poison, 2);
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

    // ícones de status: um quadrado por efeito; Veneno e Sangramento mostram os stacks
    const icons: [string, number][] = [];
    if (this.burnT > 0) icons.push([STATUS.burn, 1]);
    if (this.poisonT > 0) icons.push([STATUS.poison, this.poisonStacks]);
    if (this.bleedT > 0) icons.push([STATUS.bleed, this.bleedStacks]);
    if (this.stunT > 0) icons.push([STATUS.stun, 1]);
    let ix = r.X(x) - (icons.reduce((s, i) => s + 6 + i[1] * 5, 0) - 6) / 2;
    const iy = r.Y(y, top - 10);
    for (const [color, count] of icons) {
      for (let k = 0; k < count; k++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(ix - 1, iy - 1, 6, 6);
        ctx.fillStyle = color;
        ctx.fillRect(ix, iy, 4, 4);
        ix += 5;
      }
      ix += 6;
    }
    if (this.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.stunT * 9 + (i * Math.PI * 2) / 3;
        r.disc(x + Math.cos(a) * this.radius, y + Math.sin(a) * this.radius * 0.5, top + 2, 3, STATUS.stun);
      }
    }
  }

  protected tint(c: string): string {
    return this.flash > 0 ? '#ffffff' : c;
  }
}
