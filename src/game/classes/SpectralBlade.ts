import type { Input } from '../../core/Input';
import { angleDiff, easeOut } from '../../core/math';
import { Ghost, Ring, SlashArc, Streak } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../Player';
import { Projectile } from '../Projectile';
import type { Actor, World } from '../World';
import type { ClassDef, ClassKit } from './ClassKit';

const COLOR = '#39e6ff';
const DARK = '#0b3442';

/** Combo de 3 cortes: os dois primeiros rápidos, o terceiro pesado (hitstop + shake). */
const SWINGS = [
  { dur: 0.24, dmg: 14, half: 1.0, knock: 170, heavy: false },
  { dur: 0.24, dmg: 14, half: 1.0, knock: 170, heavy: false },
  { dur: 0.42, dmg: 30, half: 1.55, knock: 430, heavy: true },
];
const RANGE = 108;
const HIT_AT = 0.3; // fração do golpe em que o dano acontece
const DASH_T = 0.15, DASH_SPEED = 1150, DASH_CD = 0.85;
const WINDUP_T = 0.11, THRUST_T = 0.16, THRUST_SPEED = 1550, THRUST_CD = 3.5;

function body(r: Renderer, x: number, y: number, fill: string, stroke: string | null): void {
  // capa em forma de pipa + cabeça
  r.poly([x - 12, y, 0, x + 12, y, 0, x + 9, y, 28, x, y, 36, x - 9, y, 28], fill, stroke, 2);
  r.disc(x, y, 42, 7, stroke ?? fill);
}

function silhouette(r: Renderer, x: number, y: number, alpha: number): void {
  const ctx = r.ctx;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  body(r, x, y, COLOR, null);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Upgrade "Eco Espectral": clone deixado pelo dash que executa um corte giratório. */
class BladeClone implements Actor {
  dead = false;
  private t = 0.4;
  constructor(public x: number, public y: number, private p: Player, private stacks: number) {}
  update(dt: number, w: World): void {
    if ((this.t -= dt) > 0) return;
    this.dead = true;
    w.fx.push(new SlashArc(this.x, this.y, 22, 0, Math.PI, 118, 1, COLOR, 0.24));
    w.sfx.play('slash');
    for (const e of w.enemiesInCircle(this.x, this.y, 118)) {
      this.p.hit(w, e, 16 * this.stacks, { dir: Math.atan2(e.y - this.y, e.x - this.x), knock: 200, color: COLOR });
    }
  }
  interp(): void {}
  drawGround(r: Renderer): void {
    r.ellipse(this.x, this.y, 0, 118 * (1 - this.t / 0.4), null, 'rgba(57,230,255,0.35)', 2);
  }
  draw(r: Renderer): void {
    silhouette(r, this.x, this.y, 0.45 + 0.25 * Math.sin(this.t * 40));
  }
}

export class SpectralBlade implements ClassKit {
  // combo
  private idx = 0;
  private swingT = 0;
  private swingDur = 1;
  private swingAng = 0;
  private sweep = 1;
  private hitDone = true;
  private comboT = 0;
  // dash
  private dashT = 0;
  private dx = 0; private dy = 0;
  private readonly dashHits = new Set<Enemy>();
  // estocada
  private windT = 0;
  private thrustT = 0;
  private thrustAng = 0;
  private tsx = 0; private tsy = 0;
  private readonly thrustHits = new Set<Enemy>();

  update(dt: number, p: Player, w: World, input: Input): void {
    // --- estocada: preparação ---
    if (this.windT > 0) {
      p.controlled = true;
      if ((this.windT -= dt) <= 0) {
        this.thrustT = THRUST_T;
        this.tsx = p.x;
        this.tsy = p.y;
        p.iframes = Math.max(p.iframes, THRUST_T + 0.08);
        w.sfx.play('thrust');
      }
      return;
    }
    // --- estocada: investida perfurante ---
    if (this.thrustT > 0) {
      p.controlled = true;
      const c = Math.cos(this.thrustAng), s = Math.sin(this.thrustAng);
      p.x += c * THRUST_SPEED * dt;
      p.y += s * THRUST_SPEED * dt;
      w.fx.push(new Ghost(p.x, p.y, silhouette, 0.22));
      for (const e of w.enemiesInCircle(p.x, p.y, 44)) {
        if (this.thrustHits.has(e)) continue;
        if (this.thrustHits.size === 0) {
          w.hitstop(0.085);
          w.shake(0.55);
        }
        this.thrustHits.add(e);
        const killed = p.hit(w, e, 40, { dir: this.thrustAng, knock: 320, heavy: true, color: COLOR });
        if (killed && p.up('execute')) {
          p.dashCd = 0;
          p.secCd *= 0.5;
        }
      }
      if ((this.thrustT -= dt) <= 0) {
        w.fx.push(new Streak(this.tsx, this.tsy, p.x, p.y, 22, COLOR, 0.28, 12));
        p.ix = c * 220;
        p.iy = s * 220;
      }
      return;
    }
    // --- dash ---
    if (this.dashT > 0) {
      p.controlled = true;
      p.x += this.dx * DASH_SPEED * dt;
      p.y += this.dy * DASH_SPEED * dt;
      w.fx.push(new Ghost(p.x, p.y, silhouette));
      const cut = p.up('dashcut');
      if (cut) {
        for (const e of w.enemiesInCircle(p.x, p.y, 30)) {
          if (this.dashHits.has(e)) continue;
          this.dashHits.add(e);
          p.hit(w, e, 14 * cut, { dir: Math.atan2(this.dy, this.dx) + Math.PI / 2, knock: 90, color: COLOR });
        }
      }
      this.dashT -= dt;
      return;
    }

    // --- iniciar dash / estocada ---
    if (p.dashCd <= 0 && input.consume('dash')) {
      const a = input.axis();
      const ang = a.x || a.y ? Math.atan2(a.y, a.x) : p.aim;
      this.dx = Math.cos(ang);
      this.dy = Math.sin(ang);
      this.dashT = DASH_T;
      this.swingT = 0; // dash cancela o golpe, mas preserva o passo do combo
      this.dashHits.clear();
      p.iframes = Math.max(p.iframes, DASH_T + 0.08);
      p.dashCd = p.dashCdMax = DASH_CD * p.stats.dashCd;
      w.sfx.play('dash');
      w.particles.burst(p.x, p.y, 10, 8, COLOR, 200, { dir: ang + Math.PI, cone: 0.6 });
      const clones = p.up('clone');
      if (clones) w.actors.push(new BladeClone(p.x, p.y, p, clones));
      return;
    }
    if (p.secCd <= 0 && input.consume('secondary')) {
      this.windT = WINDUP_T;
      this.thrustAng = p.aim;
      this.swingT = 0;
      this.thrustHits.clear();
      p.secCd = p.secCdMax = THRUST_CD * p.stats.secCd;
      return;
    }

    // --- combo de cortes ---
    if (this.swingT > 0) {
      this.swingT -= dt;
      p.moveFactor = 0.35;
      if (!this.hitDone && this.swingT <= this.swingDur * (1 - HIT_AT)) {
        this.hitDone = true;
        this.slash(p, w);
      }
      if (this.swingT <= 0) {
        this.comboT = 0.5;
        this.idx = (this.idx + 1) % 3;
      }
    } else {
      if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.idx = 0;
      if (input.down.primary || input.consume('primary')) {
        const s = SWINGS[this.idx];
        this.swingDur = this.swingT = s.dur / p.stats.haste;
        this.swingAng = p.aim;
        this.sweep = this.idx % 2 === 0 ? 1 : -1;
        this.hitDone = false;
        const lunge = s.heavy ? 380 : 240;
        p.ix += Math.cos(p.aim) * lunge;
        p.iy += Math.sin(p.aim) * lunge;
        w.sfx.play(s.heavy ? 'slashHeavy' : 'slash');
      }
    }
  }

  private slash(p: Player, w: World): void {
    const s = SWINGS[this.idx];
    const wide = p.up('wide');
    const range = RANGE * (1 + 0.2 * wide);
    const half = Math.min(Math.PI, s.half * (1 + 0.15 * wide));
    const ang = this.swingAng;

    w.fx.push(new SlashArc(p.x, p.y, 22, ang, half, range, this.sweep, s.heavy ? '#d8fbff' : COLOR, s.heavy ? 0.28 : 0.2));

    let hitAny = false;
    for (const e of w.enemies) {
      if (!e.active) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + e.radius) continue;
      const to = Math.atan2(dy, dx);
      if (d > e.radius + 12 && Math.abs(angleDiff(ang, to)) > half) continue;
      p.hit(w, e, s.dmg, { dir: to, knock: s.knock, heavy: s.heavy, color: s.heavy ? '#d8fbff' : undefined });
      hitAny = true;
    }
    if (hitAny) {
      w.hitstop(s.heavy ? 0.08 : 0.022);
      w.shake(s.heavy ? 0.5 : 0.16);
    }

    // upgrade "Onda Cortante": cada corte lança uma onda perfurante
    const waves = p.up('waves');
    if (waves) {
      const dmg = s.dmg * 0.4 * waves;
      w.actors.push(new Projectile({
        x: p.x + Math.cos(ang) * 40, y: p.y + Math.sin(ang) * 40, z: 20,
        ang, speed: 660, radius: s.heavy ? 46 : 30, life: s.heavy ? 0.55 : 0.42,
        color: COLOR, kind: 'wave', friendly: true,
        onHit: (e, pr) => {
          p.hit(w, e, dmg, { dir: pr.ang, knock: 110, color: COLOR });
          return false; // atravessa tudo
        },
      }));
    }
    if (s.heavy) w.fx.push(new Ring(p.x, p.y, 20, range * 0.9, 0.22, COLOR, 3));
  }

  draw(r: Renderer, p: Player): void {
    const x = p.rx, y = p.ry;
    // ângulo/comprimento da espada conforme o estado
    let sa = p.aim + 2.1;
    let len = 50;
    if (this.windT > 0) {
      sa = this.thrustAng;
      len = 26;
    } else if (this.thrustT > 0) {
      sa = this.thrustAng;
      len = 74;
    } else if (this.swingT > 0) {
      const s = SWINGS[this.idx];
      const u = 1 - this.swingT / this.swingDur;
      const e = easeOut(Math.min(1, u / 0.55));
      sa = this.swingAng + this.sweep * (-s.half + 2 * s.half * e);
      len = 58;
    }
    const c = Math.cos(sa), s = Math.sin(sa);
    const sword = () => {
      r.line(x + c * 10, y + s * 10, 22, x + c * len, y + s * len, 22, '#06222b', 7);
      r.line(x + c * 10, y + s * 10, 22, x + c * len, y + s * len, 22, '#eaffff', 3.5);
      r.glow(x + c * len, y + s * len, 22, 7, COLOR, 0.5);
    };

    if (s < 0) sword(); // espada "atrás" do corpo quando aponta para o fundo
    body(r, x, y, DARK, COLOR);
    r.disc(x + Math.cos(p.aim) * 3, y, 42, 2.5, '#06222b'); // visor
    if (s >= 0) sword();
    if (p.iframes > 0 && p.hurt <= 0) silhouette(r, x, y, 0.5);
  }
}

export const BLADE_DEF: ClassDef = {
  id: 'blade',
  name: 'Lâmina Espectral',
  role: 'Corpo a corpo · alta mobilidade',
  color: COLOR,
  hp: 110,
  speed: 295,
  dashName: 'DASH',
  secName: 'ESTOCADA',
  abilities: [
    { key: 'Botão esq.', text: 'Combo de 3 cortes em arco; o terceiro é pesado.' },
    { key: 'Espaço', text: 'Dash veloz com invulnerabilidade e rastro.' },
    { key: 'Botão dir.', text: 'Estocada perfurante que atravessa inimigos.' },
  ],
  create: () => new SpectralBlade(),
};
