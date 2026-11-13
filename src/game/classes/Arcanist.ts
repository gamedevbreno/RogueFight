import type { Input } from '../../core/Input';
import { TAU } from '../../core/math';
import { Bolt, Ghost, Ring, Streak } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { ELEMENTS } from '../config';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../Player';
import { Projectile } from '../Projectile';
import type { Actor, World } from '../World';
import type { ClassDef, ClassKit } from './ClassKit';

const COLOR = '#c78bff';
const DARK = '#2d1458';
const FIRE_INTERVAL = 0.2;
const BLINK_DIST = 240, BLINK_CD = 2.0, PULSE_R = 150;
const BLAST_R = 125, BLAST_CD = 5, BLAST_RANGE = 540;

function body(r: Renderer, x: number, y: number, fill: string, stroke: string | null): void {
  // manto trapezoidal + chapéu pontudo
  r.poly([x - 14, y, 0, x + 14, y, 0, x + 6, y, 34, x - 6, y, 34], fill, stroke, 2);
  r.poly([x - 13, y, 36, x + 13, y, 36, x + 2, y, 62], fill, stroke, 2);
}

function silhouette(r: Renderer, x: number, y: number, alpha: number): void {
  const ctx = r.ctx;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  body(r, x, y, COLOR, null);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

interface BlastOpts {
  radius: number;
  delay: number;
  damage: number;
  detonate: boolean; // detona as marcas dos inimigos atingidos
  marks?: number; // marcas aplicadas (do elemento `el`)
  el?: number;
  color: string;
  heavy?: boolean;
}

/** Explosão em área com atraso telegrafado. Base da secundária, das minas e das reações em cadeia. */
class Blast implements Actor {
  dead = false;
  private t = 0;
  constructor(public x: number, public y: number, private o: BlastOpts, private p: Player, private kit: Arcanist) {}

  update(dt: number, w: World): void {
    if ((this.t += dt) < this.o.delay) return;
    this.dead = true;
    const o = this.o;
    w.fx.push(new Ring(this.x, this.y, o.radius * 0.3, o.radius, 0.35, o.color, 7, true));
    w.particles.burst(this.x, this.y, 8, o.heavy ? 36 : 16, o.color, 460, { up: 340, size: 6 });
    w.sfx.play('blast');
    w.shake(o.heavy ? 0.55 : 0.25);

    const targets = w.enemiesInCircle(this.x, this.y, o.radius);
    for (const e of targets) {
      for (let i = 0; i < (o.marks ?? 0); i++) e.addMark(o.el ?? 0);
      // detona primeiro: se o dano bruto matasse antes, as marcas seriam desperdiçadas
      if (o.detonate) this.kit.detonate(this.p, w, e);
      if (e.active) {
        this.p.hit(w, e, o.damage, { dir: Math.atan2(e.y - this.y, e.x - this.x), knock: 230, color: o.color, heavy: o.heavy });
      }
    }
    if (o.heavy && targets.length) w.hitstop(0.06);
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    const u = Math.min(1, this.t / this.o.delay);
    const ctx = r.ctx;
    ctx.globalAlpha = 0.9;
    r.ellipse(this.x, this.y, 0, this.o.radius, null, this.o.color, 2.5);
    ctx.globalAlpha = 0.28;
    r.ellipse(this.x, this.y, 0, this.o.radius * u, this.o.color);
    ctx.globalAlpha = 1;
  }

  draw(): void {}
}

export class Arcanist implements ClassKit {
  private fireT = 0;
  private el = 0; // próximo elemento do ciclo Brasa -> Geada -> Raio
  private clock = 0;

  update(dt: number, p: Player, w: World, input: Input): void {
    this.fireT -= dt;
    this.clock += dt;

    if (p.dashCd <= 0 && input.consume('dash')) this.blink(p, w, input);
    if (p.secCd <= 0 && input.consume('secondary')) this.castBlast(p, w);

    if (input.down.primary) {
      p.moveFactor = 0.78;
      if (this.fireT <= 0) this.shoot(p, w);
    }
  }

  private shoot(p: Player, w: World): void {
    this.fireT = FIRE_INTERVAL / p.stats.haste;
    const el = this.el;
    this.el = (el + 1) % 3;
    const n = 1 + p.up('multishot');
    for (let i = 0; i < n; i++) {
      const ang = p.aim + (i - (n - 1) / 2) * 0.16;
      w.actors.push(new Projectile({
        x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, z: 28,
        ang, speed: 780, radius: 9, life: 0.85,
        color: ELEMENTS[el].color, kind: 'orb', friendly: true,
        onHit: (e, pr) => this.orbHit(p, w, e, pr, el),
      }));
    }
    w.sfx.play('orb');
  }

  private orbHit(p: Player, w: World, e: Enemy, pr: Projectile, el: number): boolean {
    const killed = p.hit(w, e, 9 * 0.8 ** pr.bounces, { dir: pr.ang, knock: 60, color: ELEMENTS[el].color });
    if (!killed) for (let i = 0; i < 1 + p.up('overmark'); i++) e.addMark(el);

    // upgrade "Ricochete": salta para o inimigo mais próximo ainda não atingido
    if (pr.bounces < p.up('ricochet')) {
      const next = w.nearestEnemy(e.x, e.y, 340, pr.hitSet);
      if (next) {
        pr.bounces++;
        pr.aimAt(next.x, next.y);
        pr.life = 0.6;
        return false;
      }
    }
    return true;
  }

  /** Consome as marcas do inimigo. Cada elemento presente dispara um efeito próprio. */
  detonate(p: Player, w: World, e: Enemy): void {
    const n = e.marks.length;
    if (!n || !e.active) return;
    const c = [0, 0, 0];
    for (const m of e.marks) c[m]++;
    e.marks.length = 0;

    w.fx.push(new Ring(e.x, e.y, 10, 44 + n * 14, 0.3, COLOR, 5));
    w.particles.burst(e.x, e.y, e.height * 0.5, 6 + n * 3, COLOR, 320);
    w.sfx.play('detonate');

    if (c[0]) {
      // Brasa: queimadura
      e.burn = 6 * c[0] * p.stats.damage;
      e.burnT = 3;
    }
    if (c[1]) e.slowT = Math.max(e.slowT, 1.2 + 0.7 * c[1]); // Geada: lentidão
    if (c[2]) {
      // Raio: arco elétrico que salta entre inimigos próximos
      const seen = new Set<Enemy>([e]);
      let from = e;
      for (let i = 0; i < c[2] + 1; i++) {
        const t = w.nearestEnemy(from.x, from.y, 270, seen);
        if (!t) break;
        seen.add(t);
        w.fx.push(new Bolt(from.x, from.y, from.height * 0.6, t.x, t.y, t.height * 0.6, ELEMENTS[2].color));
        p.hit(w, t, 6 + 4 * c[2], { color: ELEMENTS[2].color });
        from = t;
      }
      w.sfx.play('zap');
    }

    const killed = p.hit(w, e, 9 * n, { color: COLOR, heavy: n >= 4 });

    // upgrade "Reação em Cadeia": morte por detonação explode e detona os vizinhos
    const chain = p.up('chain');
    if (killed && chain) {
      w.actors.push(new Blast(e.x, e.y, { radius: 130, delay: 0.16, damage: 10 * chain, detonate: true, marks: 1, el: 0, color: ELEMENTS[0].color }, p, this));
    }
  }

  private blink(p: Player, w: World, input: Input): void {
    const a = input.axis();
    const moving = a.x !== 0 || a.y !== 0;
    const ang = moving ? Math.atan2(a.y, a.x) : p.aim;
    const d = moving ? BLINK_DIST : Math.min(BLINK_DIST, Math.max(70, Math.hypot(p.aimX - p.x, p.aimY - p.y)));
    const ox = p.x, oy = p.y;

    p.x += Math.cos(ang) * d;
    p.y += Math.sin(ang) * d;
    w.clampArena(p, p.radius);
    p.px = p.x; // teleporte: não interpolar o deslocamento
    p.py = p.y;
    p.iframes = Math.max(p.iframes, 0.3);
    p.dashCd = p.dashCdMax = BLINK_CD * p.stats.dashCd;

    w.fx.push(new Ghost(ox, oy, silhouette, 0.4));
    w.fx.push(new Streak(ox, oy, p.x, p.y, 26, COLOR, 0.25, 6));
    w.particles.burst(ox, oy, 26, 14, COLOR, 220);
    // pulso de repulsão na chegada
    w.fx.push(new Ring(p.x, p.y, 20, PULSE_R, 0.3, COLOR, 6, true));
    for (const e of w.enemiesInCircle(p.x, p.y, PULSE_R)) {
      p.hit(w, e, 6, { dir: Math.atan2(e.y - p.y, e.x - p.x), knock: 580, color: COLOR });
    }
    w.sfx.play('blink');
    w.shake(0.2);

    // upgrade "Eco Instável": mina arcana na origem
    const mine = p.up('mine');
    if (mine) {
      const el = this.el;
      w.actors.push(new Blast(ox, oy, { radius: 115, delay: 0.55, damage: 12 * mine, detonate: false, marks: 2, el, color: ELEMENTS[el].color }, p, this));
    }
  }

  private castBlast(p: Player, w: World): void {
    let tx = p.aimX, ty = p.aimY;
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > BLAST_RANGE) {
      tx = p.x + ((tx - p.x) / d) * BLAST_RANGE;
      ty = p.y + ((ty - p.y) / d) * BLAST_RANGE;
    }
    const big = 1 + 0.25 * p.up('bigblast');
    w.actors.push(new Blast(tx, ty, { radius: BLAST_R * big, delay: 0.35, damage: 24 * big, detonate: true, color: COLOR, heavy: true }, p, this));
    p.secCd = p.secCdMax = BLAST_CD * p.stats.secCd;
    w.sfx.play('cast');
  }

  draw(r: Renderer, p: Player): void {
    const x = p.rx, y = p.ry;
    // 3 cristais elementais orbitando; o próximo a ser disparado fica maior
    const orbs = [0, 1, 2].map((i) => {
      const a = this.clock * 2.4 + (i * TAU) / 3;
      return { i, ox: x + Math.cos(a) * 24, oy: y + Math.sin(a) * 24, z: 30 + Math.sin(this.clock * 3 + i) * 4 };
    });
    const drawOrb = (o: (typeof orbs)[number]) => {
      const big = o.i === this.el;
      r.glow(o.ox, o.oy, o.z, big ? 10 : 6, ELEMENTS[o.i].color, 0.45);
      r.disc(o.ox, o.oy, o.z, big ? 5 : 3.2, ELEMENTS[o.i].color);
    };
    for (const o of orbs) if (o.oy < y) drawOrb(o);
    body(r, x, y, DARK, COLOR);
    r.disc(x + Math.cos(p.aim) * 3, y, 30, 2.5, '#f3e6ff');
    for (const o of orbs) if (o.oy >= y) drawOrb(o);
    if (p.iframes > 0 && p.hurt <= 0) silhouette(r, x, y, 0.5);
  }
}

export const MAGE_DEF: ClassDef = {
  id: 'mage',
  name: 'Arcanista',
  role: 'À distância · controle e combos elementais',
  color: COLOR,
  hp: 85,
  speed: 270,
  dashName: 'BLINK',
  secName: 'EXPLOSÃO',
  abilities: [
    { key: 'Botão esq.', text: 'Orbes rápidos que aplicam marcas de Brasa, Geada e Raio.' },
    { key: 'Espaço', text: 'Blink: teleporte com pulso de repulsão.' },
    { key: 'Botão dir.', text: 'Explosão no cursor que detona as marcas acumuladas.' },
  ],
  create: () => new Arcanist(),
};
