import type { Input } from '../../core/Input';
import { TAU, angleDiff, clamp, easeOut, lerp, rand } from '../../core/math';
import { Ghost, Ring, SlashArc, type Fx } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing, type Facing } from '../../render/Sprites';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../Player';
import type { Actor, HitOpts, World } from '../World';
import type { ClassDef, ClassKit } from './ClassKit';

const COLOR = '#ffb830';

/** Combo de martelo: dois golpes em arco largo e um terceiro que esmaga o chão. */
const SWINGS = [
  { dur: 0.36, dmg: 20, half: 1.2, knock: 280, slam: false },
  { dur: 0.36, dmg: 20, half: 1.2, knock: 280, slam: false },
  { dur: 0.56, dmg: 40, half: 0, knock: 540, slam: true },
];
const RANGE = 118;
const HIT_AT = 0.4; // fração do golpe em que o dano acontece (martelo é mais lento que espada)
const SLAM_R = 125, SLAM_REACH = 80; // onda sísmica do 3º golpe, centrada à frente
const RAM_T = 0.24, RAM_SPEED = 880, RAM_CD = 1.7;
const LEAP_T = 0.54, LEAP_RANGE = 320, LEAP_R = 155, LEAP_H = 130, LEAP_CD = 6;
const AFTERSHOCK_DELAY = 0.45;

interface Pose extends Facing {
  anim: string;
  frame: number;
}

function silhouette(r: Renderer, x: number, y: number, z: number, alpha: number, pose: Pose): void {
  r.sprite(SHEETS.warrior, pose.anim, pose.frame, x, y, z, { flip: pose.flip, dir: pose.dir, tint: COLOR, alpha, add: true });
}

/** Rachaduras no chão depois de um impacto (só visual). */
class Cracks implements Fx {
  ground = true;
  private t = 0;
  private readonly seed = rand(TAU);
  constructor(private x: number, private y: number, private radius: number, private life = 1.1) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const a = 1 - this.t / this.life;
    r.ctx.globalAlpha = a;
    for (let i = 0; i < 7; i++) {
      const ang = this.seed + (i * TAU) / 7;
      const len = this.radius * (0.7 + 0.3 * Math.sin(i * 2.7));
      const mx = this.x + Math.cos(ang + 0.25) * len * 0.5, my = this.y + Math.sin(ang + 0.25) * len * 0.5;
      r.line(this.x, this.y, 0, mx, my, 0, '#1a0f04', 5);
      r.line(mx, my, 0, this.x + Math.cos(ang) * len, this.y + Math.sin(ang) * len, 0, '#1a0f04', 3);
      r.line(this.x, this.y, 0, mx, my, 0, COLOR, 1.5);
    }
    r.ctx.globalAlpha = 1;
  }
}

/** Carta Abalo Sísmico: a fissura deixada pelo impacto explode de novo depois de um instante. */
class Aftershock implements Actor {
  dead = false;
  private t = 0;
  constructor(public x: number, public y: number, private radius: number, private damage: number, private p: Player) {}
  update(dt: number, w: World): void {
    if ((this.t += dt) < AFTERSHOCK_DELAY) return;
    this.dead = true;
    w.fx.push(new Ring(this.x, this.y, this.radius * 0.3, this.radius, 0.3, COLOR, 7, true));
    w.particles.burst(this.x, this.y, 6, 20, COLOR, 380, { up: 300, size: 6 });
    w.sfx.play('blast');
    w.shake(0.3);
    for (const e of w.enemiesInCircle(this.x, this.y, this.radius)) {
      this.p.hit(w, e, this.damage, { dir: Math.atan2(e.y - this.y, e.x - this.x), knock: 240, color: COLOR, hammer: true });
    }
  }
  interp(): void {}
  drawGround(r: Renderer): void {
    const u = this.t / AFTERSHOCK_DELAY;
    r.ctx.globalAlpha = 0.5 + 0.5 * u;
    r.ellipse(this.x, this.y, 0, this.radius, null, COLOR, 2);
    r.ellipse(this.x, this.y, 0, this.radius * u, 'rgba(255,184,48,0.22)');
    r.ctx.globalAlpha = 1;
  }
  draw(): void {}
}

export class Warrior implements ClassKit {
  // combo
  private idx = 0;
  private swingT = 0;
  private swingDur = 1;
  private swingAng = 0;
  private sweep = 1;
  private hitDone = true;
  private comboT = 0;
  // ariete
  private ramT = 0;
  private dx = 0; private dy = 0;
  private readonly ramHits = new Set<Enemy>();
  // salto sísmico
  private leapT = 0;
  private sx = 0; private sy = 0;
  private tx = 0; private ty = 0;

  /** +22% de alcance e raio por nível de Martelo Trovejante. */
  private reach(p: Player): number {
    return 1 + 0.22 * p.up('shockwave');
  }

  /**
   * Golpe de martelo em um inimigo. Revide Brutal: se o golpe estiver energizado,
   * sai com +60%/nível de dano e crítico garantido.
   */
  private smash(p: Player, w: World, e: Enemy, dmg: number, o: HitOpts): boolean {
    const emp = p.empowered ? p.up('retaliate') : 0;
    return p.hit(w, e, dmg, { ...o, hammer: true, mult: 1 + 0.6 * emp, forceCrit: emp > 0 });
  }

  update(dt: number, p: Player, w: World, input: Input): void {
    // --- salto sísmico: parábola em Z até o ponto mirado ---
    if (this.leapT > 0) {
      p.controlled = true;
      this.leapT -= dt;
      const u = clamp(1 - this.leapT / LEAP_T, 0, 1);
      p.x = lerp(this.sx, this.tx, u);
      p.y = lerp(this.sy, this.ty, u);
      p.z = Math.sin(Math.PI * u) * LEAP_H;
      // Gravidade Esmagadora: puxa os inimigos para o centro da cratera antes do impacto
      const pull = p.up('vortex');
      if (pull) {
        for (const e of w.enemiesInCircle(this.tx, this.ty, LEAP_R * this.reach(p) * 1.7)) {
          const d = Math.hypot(e.x - this.tx, e.y - this.ty) || 1;
          if (d < 24) continue;
          e.kvx -= ((e.x - this.tx) / d) * 2600 * pull * e.knockMul * dt;
          e.kvy -= ((e.y - this.ty) / d) * 2600 * pull * e.knockMul * dt;
        }
      }
      if (this.leapT <= 0) this.land(p, w);
      return;
    }
    // --- ariete: dash blindado que atropela ---
    if (this.ramT > 0) {
      p.controlled = true;
      p.x += this.dx * RAM_SPEED * dt;
      p.y += this.dy * RAM_SPEED * dt;
      const pose = this.pose(p);
      w.fx.push(new Ghost(p.x, p.y, (r, x, y, a) => silhouette(r, x, y, 0, a, pose)));
      const ang = Math.atan2(this.dy, this.dx);
      for (const e of w.enemiesInCircle(p.x, p.y, 40)) {
        if (this.ramHits.has(e)) continue;
        if (this.ramHits.size === 0) {
          w.hitstop(0.05);
          w.shake(0.35);
        }
        this.ramHits.add(e);
        // empurrão lateral: para o lado em que o inimigo já estava em relação à investida
        const side = Math.sign(angleDiff(ang, Math.atan2(e.y - p.y, e.x - p.x))) || 1;
        p.hit(w, e, 18, { dir: ang + side * 1.2, knock: 560, color: COLOR, heavy: true });
      }
      this.ramT -= dt;
      return;
    }

    // --- iniciar ariete / salto ---
    if (p.dashCd <= 0 && input.consume('dash')) {
      const a = input.axis();
      const ang = a.x || a.y ? Math.atan2(a.y, a.x) : p.aim;
      this.dx = Math.cos(ang);
      this.dy = Math.sin(ang);
      this.ramT = RAM_T;
      this.swingT = 0;
      this.ramHits.clear();
      p.iframes = Math.max(p.iframes, RAM_T + 0.1);
      p.dashCd = p.dashCdMax = RAM_CD * p.stats.dashCd;
      p.guard(3); // Casca de Titã
      if (p.up('retaliate')) p.empowered = true; // Revide Brutal
      w.sfx.play('dash');
      w.particles.burst(p.x, p.y, 10, 10, COLOR, 220, { dir: ang + Math.PI, cone: 0.6 });
      return;
    }
    if (p.secCd <= 0 && input.consume('secondary')) {
      const d = Math.hypot(p.aimX - p.x, p.aimY - p.y) || 1;
      const k = Math.min(1, LEAP_RANGE / d);
      const target = { x: p.x + (p.aimX - p.x) * k, y: p.y + (p.aimY - p.y) * k };
      w.clampArena(target, p.radius);
      this.sx = p.x; this.sy = p.y;
      this.tx = target.x; this.ty = target.y;
      this.leapT = LEAP_T;
      this.swingT = 0;
      this.swingAng = Math.atan2(this.ty - this.sy, this.tx - this.sx);
      p.iframes = Math.max(p.iframes, LEAP_T + 0.12);
      p.secCd = p.secCdMax = LEAP_CD * p.stats.secCd;
      p.guard(3);
      w.sfx.play('charge');
      return;
    }

    // --- combo de martelo ---
    if (this.swingT > 0) {
      this.swingT -= dt;
      p.moveFactor = 0.3;
      if (!this.hitDone && this.swingT <= this.swingDur * (1 - HIT_AT)) {
        this.hitDone = true;
        if (SWINGS[this.idx].slam) this.slam(p, w);
        else this.swing(p, w);
      }
      if (this.swingT <= 0) {
        this.comboT = 0.6;
        this.idx = (this.idx + 1) % 3;
      }
    } else {
      if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.idx = 0;
      if (input.down.primary || input.consume('primary')) {
        const s = SWINGS[this.idx];
        this.swingDur = this.swingT = s.dur / p.haste;
        this.swingAng = p.aim;
        this.sweep = this.idx % 2 === 0 ? 1 : -1;
        this.hitDone = false;
        const lunge = s.slam ? 300 : 200;
        p.ix += Math.cos(p.aim) * lunge;
        p.iy += Math.sin(p.aim) * lunge;
        w.sfx.play(s.slam ? 'slashHeavy' : 'slash');
      }
    }
  }

  /** Golpes 1 e 2: arco largo à frente. */
  private swing(p: Player, w: World): void {
    const s = SWINGS[this.idx];
    const range = RANGE * this.reach(p);
    const ang = this.swingAng;
    w.fx.push(new SlashArc(p.x, p.y, 24, ang, s.half, range, this.sweep, COLOR, 0.24));
    let hitAny = false;
    for (const e of w.enemies) {
      if (!e.active) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + e.radius) continue;
      const to = Math.atan2(dy, dx);
      if (d > e.radius + 14 && Math.abs(angleDiff(ang, to)) > s.half) continue;
      this.smash(p, w, e, s.dmg, { dir: to, knock: s.knock, color: COLOR });
      hitAny = true;
    }
    if (hitAny) {
      w.hitstop(0.035);
      w.shake(0.25);
      p.empowered = false;
    }
  }

  /** Golpe 3: esmaga o chão à frente e solta uma onda de choque sísmica circular. */
  private slam(p: Player, w: World): void {
    const s = SWINGS[this.idx];
    const R = SLAM_R * this.reach(p);
    const cx = p.x + Math.cos(this.swingAng) * SLAM_REACH, cy = p.y + Math.sin(this.swingAng) * SLAM_REACH;
    this.quake(p, w, cx, cy, R, s.dmg, s.knock, 0.09, 0.65);
  }

  /** Aterrissagem do Salto Sísmico. */
  private land(p: Player, w: World): void {
    p.z = 0;
    p.x = this.tx;
    p.y = this.ty;
    this.quake(p, w, p.x, p.y, LEAP_R * this.reach(p), 56, 420, 0.11, 0.85);
    w.sfx.play('slam');
  }

  /** Impacto no chão compartilhado pelo 3º golpe e pelo Salto Sísmico. */
  private quake(p: Player, w: World, x: number, y: number, R: number, dmg: number, knock: number, stop: number, shake: number): void {
    w.fx.push(new Ring(x, y, R * 0.25, R, 0.35, COLOR, 9, true));
    w.fx.push(new Ring(x, y, R * 0.15, R * 0.7, 0.25, '#fff2c8', 4));
    w.fx.push(new Cracks(x, y, R));
    w.particles.burst(x, y, 4, 34, COLOR, 460, { up: 340, size: 6 });
    w.particles.burst(x, y, 4, 14, '#6a4a2e', 300, { up: 380, size: 7, life: 0.7 });
    w.sfx.play('blast');
    let hitAny = false;
    for (const e of w.enemiesInCircle(x, y, R)) {
      this.smash(p, w, e, dmg, { dir: Math.atan2(e.y - y, e.x - x), knock, heavy: true, color: COLOR });
      hitAny = true;
    }
    w.hitstop(hitAny ? stop : stop * 0.4);
    w.shake(shake);
    if (hitAny) p.empowered = false;
    const after = p.up('aftershock');
    if (after) w.actors.push(new Aftershock(x, y, R, dmg * 0.45 * after, p));
  }

  private pose(p: Player): Pose {
    let ang = p.aim;
    let anim = 'idle';
    let frame = Math.floor(p.t * 6) % 4;
    if (this.leapT > 0) {
      anim = 'dash';
      frame = 1;
      ang = this.swingAng;
    } else if (this.ramT > 0) {
      anim = 'dash';
      frame = this.ramT > RAM_T * 0.6 ? 0 : 1;
      ang = Math.atan2(this.dy, this.dx);
    } else if (this.swingT > 0) {
      anim = 'attack';
      frame = Math.min(3, Math.floor((1 - this.swingT / this.swingDur) * 4));
      ang = this.swingAng;
    } else if (p.moving) {
      anim = 'run';
      frame = Math.floor(p.t * 11) % 6;
    }
    return { anim, frame, ...facing(ang) };
  }

  draw(r: Renderer, p: Player): void {
    const x = p.rx, y = p.ry, z = p.rz;
    const pose = this.pose(p);

    // o martelo gira por código, exatamente no arco do golpe (como a espada da Lâmina)
    let ha = p.aim + 0.5;
    let len = 60;
    let hz = z + 30;
    if (this.leapT > 0) {
      ha = this.swingAng + 2.4; // erguido para trás durante o salto
      len = 64;
      hz = z + 52;
    } else if (this.ramT > 0) {
      ha = Math.atan2(this.dy, this.dx) + 0.2;
      len = 52;
      hz = z + 26;
    } else if (this.swingT > 0) {
      const s = SWINGS[this.idx];
      const u = 1 - this.swingT / this.swingDur;
      if (s.slam) {
        // 3º golpe: ergue por cima do ombro e desce esmagando à frente
        const e = easeOut(clamp((u - 0.1) / 0.32, 0, 1));
        ha = this.swingAng + (1 - e) * 2.6;
        len = 56 + 26 * e;
        hz = z + 54 - 36 * e;
      } else {
        const e = easeOut(Math.min(1, u / 0.6));
        ha = this.swingAng + this.sweep * (-s.half + 2 * s.half * e);
        len = 70;
      }
    }
    const c = Math.cos(ha), s = Math.sin(ha);
    const scale = (len / 60) * this.reach(p) ** 0.45;
    const hammer = () => r.weapon3d(SHEETS.hammer, x + c * 12, y + s * 12, hz, ha, scale);

    if (s < 0) hammer();
    r.sprite(SHEETS.warrior, pose.anim, pose.frame, x, y, z, pose);
    if (s >= 0) hammer();
    if (p.empowered) r.glow(x + c * len, y + s * len, hz, 16 + 4 * Math.sin(p.t * 14), COLOR, 0.55); // martelo energizado
    if (p.iframes > 0 && p.hurt <= 0) silhouette(r, x, y, z, 0.45, pose);
  }
}

export const WARRIOR_DEF: ClassDef = {
  id: 'warrior',
  name: 'Valquíria de Ferro',
  role: 'Corpo a corpo · golpes pesados em área',
  color: COLOR,
  hp: 140,
  speed: 255,
  dashName: 'ARIETE',
  secName: 'TERREMOTO',
  abilities: [
    { key: 'Botão esq.', text: 'Combo de 3 marteladas; a terceira esmaga o chão em área.' },
    { key: 'Espaço', text: 'Ariete: investida blindada que atropela e empurra.' },
    { key: 'Botão dir.', text: 'Salto Sísmico até a mira, com impacto pesado em área.' },
  ],
  create: () => new Warrior(),
};
