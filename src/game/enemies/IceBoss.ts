import { TAU, clamp, lerp, rand } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { IceSpike } from '../IceSpike';
import { FrostPool } from '../LavaPool';
import { Projectile } from '../Projectile';
import type { World } from '../World';
import { iceShards } from './Cryomancer';
import { Enemy } from './Enemy';
import { FrostStalker } from './FrostStalker';

const COLOR = '#68e8ff';
const HP = 4200;
const LANCE_WIND = 0.7, LANCE_GAP = 0.5;
const LEAP_R = 170, LEAP_CROUCH = 0.45, LEAP_AIR = 0.75, LEAP_REC = 0.9, LEAP_RANGE = 460;
const SUMMON_WIND = 0.9;
const ROAR_T = 1.0;

type State = 'idle' | 'lances' | 'leap' | 'summon' | 'roar';
const PATTERN: State[] = ['lances', 'leap', 'summon', 'lances', 'leap'];

/**
 * Soberano do Inverno — Boss final (Fase 3).
 *   lanças   leques sucessivos de lanças de cristal que estilhaçam no fim do alcance
 *   salto    Salto Glacial: impacto + anéis concêntricos de espinhos de gelo
 *   invocar  Zonas de Geada ao redor do jogador + Lobos Glaciais
 * Com 50% de vida enfurece: mais lanças, mais anéis, mais lobos e ritmo maior.
 */
export class IceBoss extends Enemy {
  private state: State = 'idle';
  private t = 0;
  private cd = 1.4;
  private ang = Math.PI / 2;
  private clock = 0;
  private step = 0;
  private emitT = 0;
  private left = 0; // leques de lanças que faltam
  private sx = 0; private sy = 0;
  private tx = 0; private ty = 0;
  private landed = false;
  private cast = false;

  constructor(x: number, y: number) {
    super(x, y, { hp: HP, radius: 48, speed: 84, color: COLOR, knockMul: 0, height: 160 });
    this.showBar = false;
    this.stunMul = 0.3;
    this.bossName = 'Soberano do Inverno';
  }

  private get rage(): number {
    return this.enraged ? 1.3 : 1;
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.clock += dt;

    if (Math.random() < dt * (this.enraged ? 36 : 12)) {
      w.particles.burst(this.x + rand(-50, 50), this.y + rand(-26, 26), this.z + rand(10, 150), 1, Math.random() < 0.4 ? '#ffffff' : COLOR, 40,
        { up: 60, g: 120, life: 0.9, size: 5 });
    }

    switch (this.state) {
      case 'idle':
        this.ang = Math.atan2(dy, dx);
        if (!this.enraged && this.hp <= this.maxHp * 0.5) {
          this.enrage(w);
          break;
        }
        if (d > 200) {
          const k = this.speed * this.rage * Math.max(slow, 0.75);
          this.x += (dx / d) * k * dt;
          this.y += (dy / d) * k * dt;
        }
        if ((this.cd -= dt * this.rage) <= 0) this.choose(w, d);
        break;

      case 'lances': // leques de lanças de cristal mirados no jogador
        this.t += dt * this.rage;
        this.ang = Math.atan2(dy, dx);
        if (this.t < LANCE_WIND) break;
        if (this.left > 0 && (this.emitT -= dt * this.rage) <= 0) {
          this.emitT = LANCE_GAP;
          this.left--;
          const n = this.enraged ? 7 : 5;
          // leques alternados: o segundo cobre as frestas do primeiro
          const shift = this.left % 2 ? 0.11 : 0;
          for (let i = 0; i < n; i++) {
            const a = this.ang + (i - (n - 1) / 2) * 0.22 + shift;
            w.actors.push(new Projectile({
              x: this.x + Math.cos(a) * 44, y: this.y + Math.sin(a) * 44, z: 40,
              ang: a, speed: 340, radius: 10, life: 1.15,
              color: COLOR, kind: 'bolt', friendly: false, damage: 11, chillChance: 0.3,
              onEnd: (pr) => iceShards(w, pr.x, pr.y, 3, 260, 5),
            }));
          }
          w.sfx.play('shoot');
        }
        if (this.left <= 0 && (this.emitT -= dt) <= 0) this.rest();
        break;

      case 'leap': {
        this.t += dt * (this.landed ? 1 : this.rage);
        if (!this.landed) {
          const u = clamp((this.t - LEAP_CROUCH) / LEAP_AIR, 0, 1);
          this.x = lerp(this.sx, this.tx, u);
          this.y = lerp(this.sy, this.ty, u);
          this.z = Math.sin(Math.PI * u) * 170;
          if (u >= 1) this.land(w);
        } else if (this.t >= LEAP_REC) this.rest();
        break;
      }

      case 'summon':
        this.t += dt * this.rage;
        if (!this.cast && this.t >= SUMMON_WIND) {
          this.cast = true;
          const base = rand(TAU);
          for (let i = 0; i < 2; i++) { // Zonas de Geada perto do jogador
            const a = base + i * Math.PI;
            const pos = { x: p.x + Math.cos(a) * rand(120, 230), y: p.y + Math.sin(a) * rand(120, 230) };
            w.clampArena(pos, 100);
            w.actors.push(new FrostPool(pos.x, pos.y));
          }
          const wolves = this.enraged ? 3 : 2;
          if (w.enemies.length - 1 < 6) {
            for (let i = 0; i < wolves; i++) {
              const a = this.clock + (i * TAU) / wolves;
              const pos = { x: this.x + Math.cos(a) * 160, y: this.y + Math.sin(a) * 160 };
              w.clampArena(pos, 30);
              w.enemies.push(new FrostStalker(pos.x, pos.y, 2));
            }
          }
          w.fx.push(new Ring(this.x, this.y, 40, 200, 0.4, COLOR, 6));
          w.sfx.play('spawn');
        }
        if (this.t >= SUMMON_WIND + 0.5) this.rest();
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
    this.cd = rand(1.0, 1.5);
  }

  private choose(w: World, d: number): void {
    this.state = PATTERN[this.step++ % PATTERN.length];
    this.t = 0;
    this.emitT = 0;
    this.cast = false;
    if (this.state === 'lances') this.left = this.enraged ? 4 : 3;
    else if (this.state === 'leap') {
      const p = w.player;
      const k = Math.min(1, LEAP_RANGE / d);
      const target = { x: this.x + (p.x - this.x) * k, y: this.y + (p.y - this.y) * k };
      w.clampArena(target, this.radius);
      this.sx = this.x; this.sy = this.y;
      this.tx = target.x; this.ty = target.y;
      this.landed = false;
    }
    w.sfx.play(this.state === 'summon' ? 'cast' : 'charge');
  }

  /** Aterrissagem: dano no centro e anéis concêntricos de espinhos, um após o outro. */
  private land(w: World): void {
    this.z = 0;
    this.landed = true;
    this.t = 0;
    w.fx.push(new Ring(this.x, this.y, 40, LEAP_R, 0.4, COLOR, 10, true));
    w.particles.burst(this.x, this.y, 6, 46, '#e8fbff', 520, { up: 340, size: 7 });
    w.sfx.play('slam');
    w.shake(0.9);
    const p = w.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < LEAP_R + p.radius * 0.5) w.damagePlayer(26, 0, 0.3);
    const rings = this.enraged ? 3 : 2;
    for (let k = 0; k < rings; k++) {
      const R = 255 + k * 150;
      const n = Math.round((TAU * R) / 150);
      const off = rand(TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i * TAU) / n;
        const pos = { x: this.x + Math.cos(a) * R, y: this.y + Math.sin(a) * R };
        // espinhos que cairiam fora da arena são descartados
        const inside = { ...pos };
        w.clampArena(inside, 30);
        if (inside.x !== pos.x || inside.y !== pos.y) continue;
        w.actors.push(new IceSpike(pos.x, pos.y, 0.1 + k * 0.34, 54, 13));
      }
    }
  }

  private enrage(w: World): void {
    this.enraged = true;
    this.state = 'roar';
    this.t = 0;
    w.fx.push(new Ring(this.x, this.y, 60, 540, 0.7, COLOR, 12, true));
    w.fx.push(new Ring(this.x, this.y, 30, 320, 0.5, '#ffffff', 6));
    w.particles.burst(this.x, this.y, 80, 80, '#e8fbff', 580, { up: 440, size: 7, life: 0.9 });
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
    w.fx.push(new Ring(this.x, this.y, 60, 720, 0.9, COLOR, 14, true));
    w.fx.push(new Ring(this.x, this.y, 30, 440, 0.6, '#ffffff', 8));
    w.particles.burst(this.x, this.y, 90, 130, COLOR, 720, { up: 540, size: 8, life: 1.3 });
    w.particles.burst(this.x, this.y, 90, 60, '#ffffff', 500, { up: 420, size: 6, life: 1.1 });
    w.sfx.play('blast');
    w.shake(1);
    w.hitstop(0.3);
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    if (this.state === 'leap' && !this.landed) {
      const u = clamp(this.t / (LEAP_CROUCH + LEAP_AIR), 0, 1);
      r.ellipse(this.tx, this.ty, 0, LEAP_R, 'rgba(104,232,255,0.1)', '#ff3030', 3);
      r.ellipse(this.tx, this.ty, 0, LEAP_R * u, 'rgba(104,232,255,0.3)');
    } else if (this.state === 'lances' && this.t < LANCE_WIND) {
      // cone de aviso dos leques
      const u = clamp(this.t / LANCE_WIND, 0, 1);
      r.ctx.globalAlpha = 0.5 * u;
      for (const s of [-0.7, 0.7]) {
        r.line(this.x, this.y, 0, this.x + Math.cos(this.ang + s) * 380, this.y + Math.sin(this.ang + s) * 380, 0, '#ff3030', 3);
      }
      r.ctx.globalAlpha = 1;
    }
  }

  protected drawBody(r: Renderer): void {
    let anim = 'walk';
    let frame = Math.floor(this.clock * 6) % 4;
    let face = this.ang;
    if (this.state === 'lances') {
      anim = 'cast';
      frame = this.t < LANCE_WIND * 0.5 ? 0 : this.t < LANCE_WIND ? 1 : 2;
    } else if (this.state === 'summon' || this.state === 'roar') {
      anim = 'cast';
      frame = this.state === 'roar' ? 1 : this.t < SUMMON_WIND * 0.5 ? 0 : this.t < SUMMON_WIND ? 1 : 2;
    } else if (this.state === 'leap') {
      anim = 'slam';
      face = Math.atan2(this.ty - this.sy, this.tx - this.sx);
      frame = this.landed ? (this.t < LEAP_REC * 0.5 ? 2 : 3) : this.t < LEAP_CROUCH ? 0 : 1;
    }
    const x = this.rx, y = this.ry, z = this.rz;
    if (this.enraged) r.glow(x, y, z + 80, 90 + 8 * Math.sin(this.clock * 9), COLOR, 0.18); // aura da fase 2
    r.sprite(SHEETS.iceBoss, anim, frame, x, y, z, {
      ...facing(face),
      tint: this.flash > 0.05 ? '#ffffff' : undefined,
    });
  }
}
