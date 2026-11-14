import { TAU, clamp, rand } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { LavaPool } from '../LavaPool';
import { Shockwave } from '../Shockwave';
import type { Actor, World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#ff8a2a';
const HP = 3400;
const WAVE_WIND = 0.8, WAVE_GAP = 0.55;
const METEOR_WIND = 0.6, METEOR_GAP = 0.14, METEOR_R = 78, METEOR_FALL = 1.1;
const LAVA_WIND = 0.8;
const ROAR_T = 1.0;

type State = 'idle' | 'wave' | 'meteor' | 'lava' | 'roar';
const PATTERN: State[] = ['wave', 'meteor', 'lava', 'wave', 'meteor'];

/** Meteoro: círculo telegrafado no chão e uma rocha em chamas que cai do céu (eixo Z). */
class Meteor implements Actor {
  dead = false;
  private t = 0;
  constructor(public x: number, public y: number, private delay: number) {}

  update(dt: number, w: World): void {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    if ((this.t += dt) < METEOR_FALL) return;
    this.dead = true;
    w.fx.push(new Ring(this.x, this.y, METEOR_R * 0.3, METEOR_R, 0.3, COLOR, 7, true));
    w.particles.burst(this.x, this.y, 6, 20, '#ffd23a', 420, { up: 320, size: 6 });
    w.sfx.play('blast');
    w.shake(0.25);
    const p = w.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < METEOR_R + p.radius * 0.5) w.damagePlayer(16, 0.35);
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    if (this.delay > 0) return;
    const u = clamp(this.t / METEOR_FALL, 0, 1);
    r.ellipse(this.x, this.y, 0, METEOR_R, 'rgba(255,90,20,0.1)', '#ff3030', 2.5);
    r.ellipse(this.x, this.y, 0, METEOR_R * u, 'rgba(255,90,20,0.3)');
  }

  draw(r: Renderer): void {
    if (this.delay > 0) return;
    const left = METEOR_FALL - this.t;
    if (left > 0.5) return; // só aparece no fim da queda
    const z = (left / 0.5) * 620;
    const x = this.x + z * 0.25; // cai em diagonal
    r.ctx.globalAlpha = 0.6;
    r.line(x + 30, this.y, z + 120, x, this.y, z, '#ff7a1a', 12);
    r.ctx.globalAlpha = 1;
    r.glow(x, this.y, z, 30, '#ff7a1a', 0.4);
    r.disc(x, this.y, z, 15, '#2a1410');
    r.disc(x, this.y, z, 11, '#ff6a14');
    r.disc(x - 3, this.y, z + 3, 5, '#ffd23a');
  }
}

/**
 * Senhor das Cinzas — Boss da Fase 2.
 * Ondas de fogo em anéis sucessivos, chuva de meteoros telegrafada e invocação de poças
 * de lava. Com 50% de vida enfurece: mais anéis, mais meteoros, mais poças e ritmo maior.
 */
export class FireBoss extends Enemy {
  private state: State = 'idle';
  private t = 0;
  private cd = 1.4;
  private ang = Math.PI / 2;
  private clock = 0;
  private step = 0;
  private emitT = 0;
  private left = 0; // anéis ou meteoros que faltam soltar
  private cast = false;

  constructor(x: number, y: number) {
    super(x, y, { hp: HP, radius: 50, speed: 70, color: COLOR, knockMul: 0, height: 175 });
    this.showBar = false;
    this.stunMul = 0.3;
    this.bossName = 'Senhor das Cinzas';
  }

  private get rage(): number {
    return this.enraged ? 1.3 : 1;
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.clock += dt;
    this.ang = Math.atan2(dy, dx);

    if (Math.random() < dt * (this.enraged ? 40 : 14)) {
      w.particles.burst(this.x + rand(-50, 50), this.y + rand(-26, 26), rand(10, 150), 1, Math.random() < 0.35 ? '#ffd23a' : '#ff6a14', 40,
        { up: 300, g: -90, life: 0.8, size: 6 });
    }

    switch (this.state) {
      case 'idle':
        if (!this.enraged && this.hp <= this.maxHp * 0.5) {
          this.enrage(w);
          break;
        }
        if (d > 220) {
          const k = this.speed * this.rage * Math.max(slow, 0.75);
          this.x += (dx / d) * k * dt;
          this.y += (dy / d) * k * dt;
        }
        if ((this.cd -= dt * this.rage) <= 0) this.choose(w);
        break;

      case 'wave': // anéis de fogo sucessivos a partir do Boss
        this.t += dt * this.rage;
        if (this.t < WAVE_WIND) break;
        if (this.left > 0 && (this.emitT -= dt * this.rage) <= 0) {
          this.emitT = WAVE_GAP;
          this.left--;
          w.actors.push(new Shockwave(this.x, this.y, 60, 0, { speed: 330, max: 780, damage: 14, color: '#ff7a1a', burn: 0.35 }));
          w.fx.push(new Ring(this.x, this.y, 30, 120, 0.25, '#ffd23a', 6));
          w.sfx.play('slashHeavy');
          w.shake(0.3);
        }
        if (this.left <= 0 && this.emitT <= 0) this.rest();
        else if (this.left <= 0) this.emitT -= dt;
        break;

      case 'meteor': // chuva de meteoros: os primeiros miram o jogador, o resto cerca
        this.t += dt * this.rage;
        if (this.t < METEOR_WIND) break;
        if (this.left > 0 && (this.emitT -= dt) <= 0) {
          this.emitT = METEOR_GAP;
          const aimed = this.left % 4 === 0;
          const a = rand(TAU), r = aimed ? 0 : rand(90, 380);
          const pos = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
          w.clampArena(pos, 40);
          w.actors.push(new Meteor(pos.x, pos.y, 0));
          this.left--;
        }
        if (this.left <= 0) this.rest();
        break;

      case 'lava': // invoca poças de lava ao redor do jogador (com o telegraph normal delas)
        this.t += dt * this.rage;
        if (!this.cast && this.t >= LAVA_WIND) {
          this.cast = true;
          const n = this.enraged ? 3 : 2;
          const base = rand(TAU);
          for (let i = 0; i < n; i++) {
            const a = base + (i * TAU) / n;
            const pos = { x: p.x + Math.cos(a) * rand(110, 230), y: p.y + Math.sin(a) * rand(110, 230) };
            w.clampArena(pos, 100);
            w.actors.push(new LavaPool(pos.x, pos.y));
          }
          w.sfx.play('cast');
        }
        if (this.t >= LAVA_WIND + 0.5) this.rest();
        break;

      case 'roar':
        if ((this.t += dt) >= ROAR_T) {
          this.state = 'idle';
          this.cd = 0.4;
        }
        break;
    }
  }

  private rest(): void {
    this.state = 'idle';
    this.cd = rand(1.1, 1.6);
  }

  private choose(w: World): void {
    this.state = PATTERN[this.step++ % PATTERN.length];
    this.t = 0;
    this.emitT = 0;
    this.cast = false;
    if (this.state === 'wave') this.left = this.enraged ? 4 : 3;
    else if (this.state === 'meteor') this.left = this.enraged ? 14 : 9;
    w.sfx.play('charge');
  }

  private enrage(w: World): void {
    this.enraged = true;
    this.state = 'roar';
    this.t = 0;
    w.fx.push(new Ring(this.x, this.y, 60, 540, 0.7, '#ff7a1a', 12, true));
    w.fx.push(new Ring(this.x, this.y, 30, 320, 0.5, '#ffd23a', 6));
    w.particles.burst(this.x, this.y, 80, 80, '#ff6a14', 580, { up: 440, size: 7, life: 0.9 });
    w.sfx.play('roar');
    w.shake(1);
    w.hitstop(0.18);
    const p = w.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    p.ix += Math.cos(a) * 900;
    p.iy += Math.sin(a) * 900;
  }

  onDeath(w: World): void {
    for (const e of w.enemies) {
      if (e === this || e.dead) continue;
      e.dead = true;
      w.particles.burst(e.x, e.y, e.height * 0.5, 16, e.color, 320, { life: 0.6 });
    }
    w.fx.push(new Ring(this.x, this.y, 60, 720, 0.9, '#ff7a1a', 14, true));
    w.fx.push(new Ring(this.x, this.y, 30, 440, 0.6, '#ffffff', 8));
    w.particles.burst(this.x, this.y, 90, 130, '#ff6a14', 720, { up: 540, size: 8, life: 1.3 });
    w.particles.burst(this.x, this.y, 90, 60, '#ffd23a', 500, { up: 420, size: 6, life: 1.1 });
    w.sfx.play('blast');
    w.shake(1);
    w.hitstop(0.3);
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    if (this.state === 'wave' && this.t < WAVE_WIND) {
      // anel de aviso se fechando sobre o Boss antes da primeira onda
      const u = clamp(this.t / WAVE_WIND, 0, 1);
      r.ctx.globalAlpha = 0.7;
      r.ellipse(this.x, this.y, 0, 260 - 190 * u, null, '#ff3030', 3);
      r.ctx.globalAlpha = 1;
    }
  }

  protected drawBody(r: Renderer): void {
    let anim = 'walk';
    let frame = Math.floor(this.clock * 5) % 4;
    if (this.state === 'wave') {
      anim = 'wave';
      frame = this.t < WAVE_WIND * 0.5 ? 0 : this.t < WAVE_WIND ? 1 : 2;
    } else if (this.state === 'meteor' || this.state === 'lava' || this.state === 'roar') {
      anim = 'cast';
      const wind = this.state === 'meteor' ? METEOR_WIND : LAVA_WIND;
      frame = this.state === 'roar' ? 2 : this.t < wind * 0.5 ? 0 : this.t < wind ? 1 : 2;
    }
    const x = this.rx, y = this.ry;
    if (this.enraged) r.glow(x, y, 90, 96 + 9 * Math.sin(this.clock * 9), '#ff6a14', 0.2); // aura da fase 2
    r.sprite(SHEETS.fireboss, anim, frame, x, y, 0, {
      ...facing(this.ang),
      tint: this.flash > 0.05 ? '#ffffff' : undefined,
    });
  }
}
