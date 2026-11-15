import type { Input } from '../../core/Input';
import { TAU, rand } from '../../core/math';
import { Ghost, Ring, type Fx } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing, type Facing } from '../../render/Sprites';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../Player';
import { Projectile } from '../Projectile';
import type { Actor, World } from '../World';
import type { ClassDef, ClassKit } from './ClassKit';

const COLOR = '#4dff88';
const FIRE_INTERVAL = 0.27;
const ARROW_SPEED = 980, ARROW_DMG = 11;
const DASH_T = 0.2, DASH_SPEED = 1050, DASH_CD = 1.3;
const RAIN_R = 135, RAIN_RANGE = 560, RAIN_CD = 7, RAIN_GAP = 0.4, RAIN_WARN = 0.35;
const DEADEYE_DIST = 240;

interface Pose extends Facing {
  anim: string;
  frame: number;
}

function silhouette(r: Renderer, x: number, y: number, alpha: number, pose: Pose): void {
  r.sprite(SHEETS.archer, pose.anim, pose.frame, x, y, 0, { flip: pose.flip, dir: pose.dir, tint: COLOR, alpha, add: true });
}

/** Flecha caindo do céu (só visual): um risco vertical que some rápido. */
class FallingArrow implements Fx {
  private t = 0;
  constructor(private x: number, private y: number, private life = 0.2) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const u = this.t / this.life;
    const z = 300 * (1 - u);
    r.ctx.globalAlpha = 0.9;
    r.line(this.x + z * 0.12, this.y, z + 46, this.x, this.y, z, COLOR, 3);
    r.ctx.globalAlpha = 1;
  }
}

/** Chuva de Flechas: zona telegrafada que recebe várias ondas rápidas de impacto. */
class ArrowRain implements Actor {
  dead = false;
  private t = 0;
  private fired = 0;
  constructor(public x: number, public y: number, private radius: number, private waves: number, private p: Player) {}

  update(dt: number, w: World): void {
    this.t += dt;
    while (this.fired < this.waves && this.t >= RAIN_WARN + this.fired * RAIN_GAP) {
      this.fired++;
      for (let i = 0; i < 9; i++) {
        const a = rand(TAU), d = Math.sqrt(Math.random()) * this.radius;
        w.fx.push(new FallingArrow(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d));
      }
      w.fx.push(new Ring(this.x, this.y, this.radius * 0.5, this.radius, 0.22, COLOR, 3));
      w.sfx.play('orb');
      for (const e of w.enemiesInCircle(this.x, this.y, this.radius)) {
        e.slowT = Math.max(e.slowT, 0.9); // lentidão curta
        this.p.hit(w, e, 12, { color: COLOR, barbed: true });
      }
    }
    if (this.fired >= this.waves && this.t >= RAIN_WARN + this.waves * RAIN_GAP) this.dead = true;
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    const ctx = r.ctx;
    ctx.globalAlpha = 0.85;
    r.ellipse(this.x, this.y, 0, this.radius, 'rgba(77,255,136,0.08)', COLOR, 2.5);
    if (this.t < RAIN_WARN) {
      ctx.globalAlpha = 0.25;
      r.ellipse(this.x, this.y, 0, this.radius * (this.t / RAIN_WARN), COLOR);
    }
    ctx.globalAlpha = 1;
  }

  draw(): void {}
}

export class Archer implements ClassKit {
  private fireT = 0;
  private shots = 0; // conta os disparos: todo 3º é perfurante
  private shootT = 0; // tempo restante da pose de disparo
  private dashT = 0;
  private dx = 0; private dy = 0;

  update(dt: number, p: Player, w: World, input: Input): void {
    this.fireT -= dt;
    if (this.shootT > 0) this.shootT -= dt;

    if (this.dashT > 0) {
      p.controlled = true;
      p.x += this.dx * DASH_SPEED * dt;
      p.y += this.dy * DASH_SPEED * dt;
      const pose = this.pose(p);
      w.fx.push(new Ghost(p.x, p.y, (r, x, y, a) => silhouette(r, x, y, a, pose)));
      this.dashT -= dt;
      return;
    }

    if (p.dashCd <= 0 && input.consume('dash')) return this.vault(p, w, input);
    if (p.secCd <= 0 && input.consume('secondary')) this.rain(p, w);

    if (input.down.primary) {
      p.moveFactor = 0.8;
      if (this.fireT <= 0) this.shoot(p, w);
    }
  }

  /** Disparo principal; o 3º de cada sequência é uma Flecha Perfurante. */
  private shoot(p: Player, w: World): void {
    this.fireT = FIRE_INTERVAL / p.haste;
    this.shootT = 0.2;
    const piercing = ++this.shots % 3 === 0;
    const extra = p.up('splitshot'); // Tiro Duplo: flechas extras em cone estreito
    for (let i = 0; i <= extra; i++) {
      const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * 0.09 * Math.ceil(i / 2);
      this.arrow(p, w, p.aim + off, piercing && i === 0);
    }
    w.sfx.play(piercing ? 'zap' : 'orb');
  }

  private arrow(p: Player, w: World, ang: number, piercing: boolean): void {
    w.actors.push(new Projectile({
      x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22, z: 30,
      ang, speed: ARROW_SPEED, radius: piercing ? 14 : 8, life: piercing ? 0.85 : 0.7,
      color: piercing ? '#d8ffe6' : COLOR, kind: 'arrow', friendly: true,
      onHit: (e, pr) => this.arrowHit(p, w, e, pr, piercing),
    }));
  }

  private arrowHit(p: Player, w: World, e: Enemy, pr: Projectile, piercing: boolean): boolean {
    // Olho de Águia: bônus contra alvos distantes do arqueiro
    const far = Math.hypot(e.x - p.x, e.y - p.y) > DEADEYE_DIST;
    const mult = (piercing ? 1.5 : 1) * 0.85 ** pr.bounces * (far ? 1 + 0.25 * p.up('deadeye') : 1);
    p.hit(w, e, ARROW_DMG, { dir: pr.ang, knock: piercing ? 150 : 70, color: COLOR, heavy: piercing, barbed: true, mult });
    if (piercing) return false; // atravessa todos na linha de tiro

    // Flecha Ricocheteante: salta para o inimigo mais próximo ainda não atingido
    if (pr.bounces < p.up('bounce_arrow')) {
      const next = w.nearestEnemy(e.x, e.y, 340, pr.hitSet);
      if (next) {
        pr.bounces++;
        pr.aimAt(next.x, next.y);
        pr.life = 0.5;
        return false;
      }
    }
    return true;
  }

  /** Acrobacia: salto com i-frames que dispara um leque na mira (ou no inimigo mais próximo). */
  private vault(p: Player, w: World, input: Input): void {
    const a = input.axis();
    const ang = a.x || a.y ? Math.atan2(a.y, a.x) : p.aim;
    this.dx = Math.cos(ang);
    this.dy = Math.sin(ang);
    this.dashT = DASH_T;
    p.iframes = Math.max(p.iframes, DASH_T + 0.1);
    p.dashCd = p.dashCdMax = DASH_CD * p.stats.dashCd;

    const vs = p.up('vault_shot'); // Disparo Acrobático
    const near = w.nearestEnemy(p.x, p.y, 520);
    const aim = near ? Math.atan2(near.y - p.y, near.x - p.x) : p.aim;
    const n = 3 + 2 * vs;
    for (let i = 0; i < n; i++) this.arrow(p, w, aim + (i - (n - 1) / 2) * 0.16, false);
    if (vs) p.secCd = Math.max(0, p.secCd - vs);
    this.shootT = 0;
    w.sfx.play('dash');
    w.particles.burst(p.x, p.y, 10, 8, COLOR, 200, { dir: ang + Math.PI, cone: 0.6 });
  }

  /** Saraivada: chuva de flechas na área do cursor. */
  private rain(p: Player, w: World): void {
    let tx = p.aimX, ty = p.aimY;
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > RAIN_RANGE) {
      tx = p.x + ((tx - p.x) / d) * RAIN_RANGE;
      ty = p.y + ((ty - p.y) / d) * RAIN_RANGE;
    }
    const rp = p.up('rain_plus'); // Tempestade de Flechas: +25% de raio e +2 ondas por nível
    w.actors.push(new ArrowRain(tx, ty, RAIN_R * (1 + 0.25 * rp), 4 + 2 * rp, p));
    p.secCd = p.secCdMax = RAIN_CD * p.stats.secCd;
    this.shootT = 0.3;
    w.sfx.play('cast');
  }

  private pose(p: Player): Pose {
    let ang = p.aim;
    let anim = 'idle';
    let frame = Math.floor(p.t * 6) % 4;
    if (this.dashT > 0) {
      anim = 'dash';
      frame = this.dashT > DASH_T * 0.5 ? 0 : 1;
      ang = Math.atan2(this.dy, this.dx);
    } else if (this.shootT > 0) {
      anim = 'shoot';
      frame = this.shootT > 0.13 ? 1 : 2; // corda puxada, depois solta
    } else if (p.moving) {
      anim = 'run';
      frame = Math.floor(p.t * 13) % 6;
    }
    return { anim, frame, ...facing(ang) };
  }

  draw(r: Renderer, p: Player): void {
    const pose = this.pose(p);
    r.sprite(SHEETS.archer, pose.anim, pose.frame, p.rx, p.ry, 0, pose);
    // a próxima flecha é a perfurante: a ponta do arco acende
    if ((this.shots + 1) % 3 === 0) {
      r.glow(p.rx + Math.cos(p.aim) * 24, p.ry + Math.sin(p.aim) * 24, 32, 9 + 2 * Math.sin(p.t * 16), '#d8ffe6', 0.6);
    }
    if (p.iframes > 0 && p.hurt <= 0) silhouette(r, p.rx, p.ry, 0.5, pose);
  }
}

export const ARCHER_DEF: ClassDef = {
  id: 'archer',
  name: 'Caçador Astral',
  role: 'À distância · rápido e preciso',
  color: COLOR,
  hp: 95,
  speed: 315,
  dashName: 'ACROBACIA',
  secName: 'SARAIVADA',
  abilities: [
    { key: 'Botão esq.', text: 'Flechas velozes; a cada 3º disparo, uma Flecha Perfurante.' },
    { key: 'Espaço', text: 'Acrobacia: salto com invulnerabilidade que dispara um leque.' },
    { key: 'Botão dir.', text: 'Saraivada: chuva de flechas em área que causa lentidão.' },
  ],
  create: () => new Archer(),
};
