import { TAU, angleDiff, clamp, lerp, rand } from '../../core/math';
import { Ring, SlashArc } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { Projectile } from '../Projectile';
import type { Actor, World } from '../World';
import { Chaser } from './Chaser';
import { Enemy } from './Enemy';

const COLOR = '#ff3b4e';
const HP = 2800;

// golpe de glaive
const SLASH_R = 250, SLASH_HALF = 1.05, SLASH_WIND = 0.7, SLASH_REC = 0.45;
// rajada em espiral
const BARRAGE_WIND = 0.7, BARRAGE_DUR = 2.2;
// salto esmagador
const SLAM_R = 175, SLAM_CROUCH = 0.45, SLAM_AIR = 0.75, SLAM_REC = 0.8, SLAM_RANGE = 460;
// invocação
const SUMMON_WIND = 0.9, SUMMON_REC = 0.4, MAX_MINIONS = 6;
const ROAR_T = 1.0;

type State = 'idle' | 'slash' | 'barrage' | 'slam' | 'summon' | 'roar';
/** Rotação de ataques; a escolha ainda é ajustada pela distância e pelo número de lacaios. */
const PATTERN: State[] = ['barrage', 'slam', 'slash', 'summon', 'slam', 'barrage', 'slash'];

/** Onda de choque do salto: um anel que se expande pelo chão. Atravessável com i-frames. */
class Shockwave implements Actor {
  dead = false;
  private hit = false;
  constructor(public x: number, public y: number, private r: number, private delay: number) {}

  update(dt: number, w: World): void {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    this.r += 400 * dt;
    if (this.r > 640) this.dead = true;
    const p = w.player;
    if (this.hit || p.dead) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (Math.abs(d - this.r) < 18 + p.radius * 0.5 && w.damagePlayer(14)) this.hit = true;
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    if (this.delay > 0) return;
    const ctx = r.ctx;
    ctx.globalAlpha = clamp((640 - this.r) / 200, 0, 1);
    r.ellipse(this.x, this.y, 0, this.r, null, COLOR, 7);
    r.ellipse(this.x, this.y, 0, this.r - 9, null, '#ffd0a0', 2);
    ctx.globalAlpha = 1;
  }

  draw(): void {}
}

/**
 * Arconte Abissal — Boss da onda final.
 * Três ataques telegrafados (golpe de glaive, rajada em espiral, salto com onda de choque)
 * mais a invocação de perseguidores. Com 50% de vida enfurece: tudo fica mais rápido e intenso.
 */
export class Boss extends Enemy {
  readonly name = 'Arconte Abissal';
  enraged = false;

  private state: State = 'idle';
  private t = 0;
  private cd = 1.4;
  private ang = Math.PI / 2;
  private clock = 0;
  private step = 0; // posição em PATTERN
  // golpe
  private slashAng = 0;
  private slashWind = SLASH_WIND;
  private slashesLeft = 0;
  private struck = false;
  // rajada
  private fireT = 0;
  private spin = 0;
  // salto
  private sx = 0; private sy = 0;
  private tx = 0; private ty = 0;
  private landed = false;
  // invocação
  private summoned = false;

  constructor(x: number, y: number) {
    super(x, y, { hp: HP, radius: 46, speed: 88, color: COLOR, knockMul: 0, height: 150 });
    this.showBar = false;
  }

  /** Multiplicador de ritmo: a fase 2 acelera movimento, telegraphs e recargas. */
  private get rage(): number {
    return this.enraged ? 1.35 : 1;
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = this.rage * Math.max(slow, 0.75); // lentidão quase não afeta o Boss
    this.clock += dt;

    if (this.enraged && Math.random() < dt * 34) {
      w.particles.burst(this.x + rand(-46, 46), this.y + rand(-24, 24), this.z + rand(20, 130), 1, Math.random() < 0.3 ? '#ffd0a0' : COLOR, 40,
        { up: 280, g: -80, life: 0.7, size: 6 });
    }

    switch (this.state) {
      case 'idle':
        this.ang = Math.atan2(dy, dx);
        if (!this.enraged && this.hp <= this.maxHp * 0.5) {
          this.enrage(w);
          break;
        }
        if (d > 170) {
          this.x += (dx / d) * this.speed * k * dt;
          this.y += (dy / d) * this.speed * k * dt;
        }
        if ((this.cd -= dt * this.rage) <= 0) this.choose(w, d);
        break;

      case 'slash': {
        this.t += dt;
        if (!this.struck && this.t >= this.slashWind) {
          this.struck = true;
          w.fx.push(new SlashArc(this.x, this.y, 30, this.slashAng, SLASH_HALF, SLASH_R, this.slashesLeft % 2 ? 1 : -1, '#ff8a96', 0.32));
          w.sfx.play('slashHeavy');
          w.shake(0.5);
          const inArc = Math.abs(angleDiff(this.slashAng, Math.atan2(dy, dx))) <= SLASH_HALF;
          if (d < SLASH_R + p.radius && (inArc || d < this.radius + 20)) w.damagePlayer(24);
        }
        if (this.t >= this.slashWind + SLASH_REC / this.rage) {
          if (--this.slashesLeft > 0) {
            // fase 2: emenda um segundo golpe, com telegraph mais curto e nova mira
            this.t = 0;
            this.struck = false;
            this.slashWind = SLASH_WIND * 0.55;
            this.slashAng = this.ang = Math.atan2(dy, dx);
          } else this.rest();
        }
        break;
      }

      case 'barrage':
        this.t += dt;
        this.ang = Math.atan2(dy, dx);
        if (this.t >= BARRAGE_WIND) {
          this.fireT -= dt;
          const arms = this.enraged ? 3 : 2;
          while (this.fireT <= 0) {
            this.fireT += 0.115 / this.rage;
            for (let i = 0; i < arms; i++) {
              const a = this.spin + (i * TAU) / arms;
              w.actors.push(new Projectile({
                x: this.x + Math.cos(a) * 40, y: this.y + Math.sin(a) * 40, z: 40,
                ang: a, speed: 250, radius: 10, life: 4.5,
                color: COLOR, kind: 'bolt', friendly: false, damage: 10,
              }));
            }
            this.spin += 0.31;
            w.sfx.play('shoot');
          }
        }
        if (this.t >= BARRAGE_WIND + BARRAGE_DUR) this.rest();
        break;

      case 'slam': {
        this.t += dt * (this.landed ? 1 : this.rage);
        if (!this.landed) {
          const u = clamp((this.t - SLAM_CROUCH) / SLAM_AIR, 0, 1);
          this.x = lerp(this.sx, this.tx, u);
          this.y = lerp(this.sy, this.ty, u);
          this.z = Math.sin(Math.PI * u) * 170;
          if (u >= 1) this.land(w);
        } else if (this.t >= SLAM_REC) this.rest();
        break;
      }

      case 'summon':
        this.t += dt * this.rage;
        if (!this.summoned && this.t >= SUMMON_WIND) {
          this.summoned = true;
          const n = this.enraged ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = this.clock + (i * TAU) / n;
            const pos = { x: this.x + Math.cos(a) * 160, y: this.y + Math.sin(a) * 160 };
            w.clampArena(pos, 30);
            w.enemies.push(new Chaser(pos.x, pos.y, 1.5));
          }
          w.fx.push(new Ring(this.x, this.y, 40, 200, 0.4, COLOR, 6));
          w.sfx.play('spawn');
        }
        if (this.t >= SUMMON_WIND + SUMMON_REC) this.rest();
        break;

      case 'roar':
        if ((this.t += dt) >= ROAR_T) {
          this.state = 'idle';
          this.cd = 0.35;
        }
        break;
    }
  }

  private rest(): void {
    this.state = 'idle';
    this.cd = rand(1.0, 1.5);
  }

  private choose(w: World, d: number): void {
    let next = PATTERN[this.step++ % PATTERN.length];
    if (next === 'slash' && d > SLASH_R + 90) next = 'slam'; // jogador longe: fecha a distância
    if (next === 'summon' && w.enemies.length - 1 >= MAX_MINIONS) next = 'barrage';
    this.state = next;
    this.t = 0;

    if (next === 'slash') {
      this.slashAng = this.ang;
      this.slashWind = SLASH_WIND / this.rage;
      this.slashesLeft = this.enraged ? 2 : 1;
      this.struck = false;
      w.sfx.play('charge');
    } else if (next === 'barrage') {
      this.spin = this.ang;
      this.fireT = 0;
      w.sfx.play('charge');
    } else if (next === 'slam') {
      const p = w.player;
      const k = Math.min(1, SLAM_RANGE / d);
      const target = { x: this.x + (p.x - this.x) * k, y: this.y + (p.y - this.y) * k };
      w.clampArena(target, this.radius);
      this.sx = this.x; this.sy = this.y;
      this.tx = target.x; this.ty = target.y;
      this.landed = false;
      w.sfx.play('charge');
    } else {
      this.summoned = false;
      w.sfx.play('cast');
    }
  }

  private land(w: World): void {
    this.z = 0;
    this.landed = true;
    this.t = 0;
    w.fx.push(new Ring(this.x, this.y, 40, SLAM_R, 0.4, COLOR, 10, true));
    w.particles.burst(this.x, this.y, 6, 46, '#ff8a6a', 520, { up: 340, size: 7 });
    w.sfx.play('slam');
    w.shake(0.9);
    const p = w.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < SLAM_R + p.radius * 0.5) w.damagePlayer(26);
    // ondas de choque: uma na fase 1, duas na fase 2
    w.actors.push(new Shockwave(this.x, this.y, SLAM_R * 0.8, 0.05));
    if (this.enraged) w.actors.push(new Shockwave(this.x, this.y, SLAM_R * 0.8, 0.5));
  }

  private enrage(w: World): void {
    this.enraged = true;
    this.state = 'roar';
    this.t = 0;
    w.fx.push(new Ring(this.x, this.y, 60, 520, 0.7, COLOR, 12, true));
    w.fx.push(new Ring(this.x, this.y, 30, 320, 0.5, '#ffd0a0', 6));
    w.particles.burst(this.x, this.y, 70, 70, COLOR, 560, { up: 420, size: 7, life: 0.9 });
    w.sfx.play('roar');
    w.shake(1);
    w.hitstop(0.18);
    // empurra o jogador para fora do alcance: a fase 2 começa de forma justa
    const p = w.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    p.ix += Math.cos(a) * 900;
    p.iy += Math.sin(a) * 900;
  }

  onDeath(w: World): void {
    for (const e of w.enemies) {
      if (e === this || e.dead) continue;
      e.dead = true; // os lacaios caem junto com o Arconte
      w.particles.burst(e.x, e.y, e.height * 0.5, 16, e.color, 320, { life: 0.6 });
    }
    w.fx.push(new Ring(this.x, this.y, 60, 700, 0.9, COLOR, 14, true));
    w.fx.push(new Ring(this.x, this.y, 30, 420, 0.6, '#ffffff', 8));
    w.particles.burst(this.x, this.y, 80, 120, COLOR, 700, { up: 520, size: 8, life: 1.3 });
    w.particles.burst(this.x, this.y, 80, 50, '#ffd0a0', 480, { up: 400, size: 6, life: 1.1 });
    w.sfx.play('blast');
    w.shake(1);
    w.hitstop(0.3);
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    const ctx = r.ctx;
    if (this.state === 'slash' && !this.struck) {
      // setor do golpe: contorno fixo + preenchimento que cresce até o impacto
      const u = clamp(this.t / this.slashWind, 0, 1);
      const sector = (rad: number) => {
        ctx.beginPath();
        ctx.moveTo(r.X(this.x), r.Y(this.y));
        for (let i = 0; i <= 18; i++) {
          const a = this.slashAng - SLASH_HALF + (2 * SLASH_HALF * i) / 18;
          ctx.lineTo(r.X(this.x + Math.cos(a) * rad), r.Y(this.y + Math.sin(a) * rad));
        }
        ctx.closePath();
      };
      sector(SLASH_R);
      ctx.fillStyle = 'rgba(255,40,60,0.12)';
      ctx.fill();
      ctx.strokeStyle = '#ff3030';
      ctx.lineWidth = 3;
      ctx.stroke();
      sector(SLASH_R * u);
      ctx.fillStyle = 'rgba(255,40,60,0.3)';
      ctx.fill();
    } else if (this.state === 'slam' && !this.landed) {
      const u = clamp(this.t / (SLAM_CROUCH + SLAM_AIR), 0, 1);
      r.ellipse(this.tx, this.ty, 0, SLAM_R, 'rgba(255,40,60,0.12)', '#ff3030', 3);
      r.ellipse(this.tx, this.ty, 0, SLAM_R * u, 'rgba(255,40,60,0.3)');
    } else if (this.state === 'summon' && !this.summoned) {
      ctx.globalAlpha = 0.6;
      r.ellipse(this.x, this.y, 0, 60 + 140 * clamp(this.t / SUMMON_WIND, 0, 1), null, COLOR, 3);
      ctx.globalAlpha = 1;
    }
  }

  protected drawBody(r: Renderer): void {
    let anim = 'walk';
    let frame = Math.floor(this.clock * 6) % 4;
    let face = this.ang;

    switch (this.state) {
      case 'slash':
        anim = 'slash';
        face = this.slashAng;
        frame = this.t < this.slashWind * 0.5 ? 0 : this.t < this.slashWind ? 1 : this.t < this.slashWind + 0.14 ? 2 : 3;
        break;
      case 'barrage':
        anim = 'cast';
        frame = this.t < BARRAGE_WIND * 0.5 ? 0 : this.t < BARRAGE_WIND ? 1 : 2;
        break;
      case 'slam':
        anim = 'slam';
        face = Math.atan2(this.ty - this.sy, this.tx - this.sx);
        frame = this.landed ? (this.t < SLAM_REC * 0.5 ? 2 : 3) : this.t < SLAM_CROUCH ? 0 : 1;
        break;
      case 'summon':
        anim = 'cast';
        frame = this.t < SUMMON_WIND * 0.5 ? 0 : this.t < SUMMON_WIND ? 1 : 2;
        break;
      case 'roar':
        anim = 'cast';
        frame = 1;
        break;
    }

    const x = this.rx, y = this.ry, z = this.rz;
    if (this.enraged) r.glow(x, y, z + 76, 84 + 8 * Math.sin(this.clock * 9), COLOR, 0.2); // aura da fase 2
    r.sprite(SHEETS.boss, anim, frame, x, y, z, {
      ...facing(face),
      tint: this.flash > 0.05 ? '#ffffff' : undefined, // flash mais curto: ele apanha o tempo todo
    });
    const casting = (this.state === 'barrage' && this.t < BARRAGE_WIND) || (this.state === 'summon' && !this.summoned) || this.state === 'roar';
    if (casting) r.glow(x, y, z + 76, 24 + 30 * ((this.clock * 3) % 1), '#ffd0a0', 0.45);
  }
}
