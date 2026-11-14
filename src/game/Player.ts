import type { Input } from '../core/Input';
import type { Renderer } from '../render/Renderer';
import type { ClassDef, ClassKit } from './classes/ClassKit';
import type { Enemy } from './enemies/Enemy';
import type { HitOpts, World } from './World';

export interface Stats {
  maxHp: number;
  speed: number;
  damage: number; // multiplicador
  haste: number; // multiplicador de velocidade de ataque
  dashCd: number; // multiplicador de recarga
  secCd: number; // multiplicador de recarga
  crit: number; // chance 0..1
  killHeal: number;
}

export class Player {
  x = 0; y = 0;
  px = 0; py = 0; // posição no passo anterior (interpolação)
  rx = 0; ry = 0; // posição interpolada para render
  readonly radius = 15;

  ix = 0; iy = 0; // impulso (avanço dos golpes, recuo)
  aim = 0; aimX = 0; aimY = 0;
  t = 0;

  hp: number;
  readonly stats: Stats;
  /** Upgrades pegos: id -> stacks. Os kits de classe consultam via up(id). */
  readonly ups = new Map<string, number>();

  iframes = 0;
  hurt = 0;
  /** Queimadura no jogador: segundos restantes. */
  burnT = 0;
  private burnAcc = 0;
  dashCd = 0; dashCdMax = 1;
  secCd = 0; secCdMax = 1;
  dead = false;

  /** Definidos pelo kit a cada passo. */
  moving = false; // andando por input (escolhe idle/run no sprite)
  controlled = false; // kit está dirigindo o movimento (dash/estocada)
  moveFactor = 1;

  readonly kit: ClassKit;

  constructor(readonly def: ClassDef) {
    this.stats = { maxHp: def.hp, speed: def.speed, damage: 1, haste: 1, dashCd: 1, secCd: 1, crit: 0.05, killHeal: 0 };
    this.hp = def.hp;
    this.kit = def.create();
  }

  up(id: string): number {
    return this.ups.get(id) ?? 0;
  }

  heal(n: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  /** Aplica (ou renova) a Queimadura. */
  ignite(seconds: number): void {
    this.burnT = Math.max(this.burnT, seconds);
  }

  get burning(): boolean {
    return this.burnT > 0;
  }

  /** Multiplicador de dano de fogo recebido (carta Sangue de Salamandra: -70%). */
  get fireResist(): number {
    return this.up('salamander') ? 0.3 : 1;
  }

  /** Sangue de Salamandra: +25% de velocidade de movimento e de ataque enquanto queima. */
  private get frenzy(): number {
    return this.burning && this.up('salamander') ? 1.25 : 1;
  }

  /** Velocidade de ataque efetiva (os kits usam este valor, não stats.haste direto). */
  get haste(): number {
    return this.stats.haste * this.frenzy;
  }

  get speed(): number {
    return this.stats.speed * this.frenzy;
  }

  onKill(): void {
    if (this.stats.killHeal) this.heal(this.stats.killHeal);
  }

  /** Dano do jogador: aplica multiplicadores, rola crítico e os efeitos de status. Retorna true se matou. */
  hit(w: World, e: Enemy, base: number, o: HitOpts = {}): boolean {
    let dmg = base * this.stats.damage;
    const tort = this.up('torturer');
    if (tort) dmg *= 1 + 0.18 * tort * e.statusCount(); // Torturador: +18% por efeito no alvo
    const crit = Math.random() < this.stats.crit;
    if (crit) dmg *= 2;
    const killed = w.damageEnemy(e, Math.max(1, Math.round(dmg)), { ...o, crit });
    if (!killed && e.active) this.procs(w, e, o);
    return killed;
  }

  /** Cartas de status da Fase 2: cada golpe rola a chance de cada efeito. */
  private procs(w: World, e: Enemy, o: HitOpts): void {
    const d = this.stats.damage;
    const roll = (id: string, base: number, perLevel: number): boolean => {
      const n = this.up(id);
      return n > 0 && Math.random() < base + perLevel * (n - 1);
    };
    if (roll('ignite', 0.25, 0.15)) e.applyBurn(6 * d, 3);
    if (roll('venom', 0.3, 0.15)) e.applyPoison(3 * d);
    if (o.shock && roll('neural', 0.25, 0.12)) {
      e.applyStun(0.9);
      e.slowT = Math.max(e.slowT, 0.9 + 2.5); // lentidão forte depois da paralisia
    }
    // por último: a Hemorragia pode matar o alvo
    if (o.bleed && roll('serrated', 0.35, 0.2)) e.applyBleed(w, 4 * d, Math.round(34 * d));
  }

  update(dt: number, w: World, input: Input): void {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurt > 0) this.hurt -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.secCd > 0) this.secCd -= dt;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnAcc += 2 * this.fireResist * dt; // 2 de vida por segundo
      if (Math.random() < dt * 22) w.particles.burst(this.x, this.y, 30, 1, Math.random() < 0.3 ? '#ffd23a' : '#ff7a3c', 50, { up: 240, g: -80, size: 5 });
      if (this.burnAcc >= 1) {
        this.burnAcc -= 1;
        w.softDamage(1, '#ff7a3c');
        if (this.dead) return;
      }
    }
    this.aim = Math.atan2(this.aimY - this.y, this.aimX - this.x);

    this.controlled = false;
    this.moveFactor = 1;
    this.kit.update(dt, this, w, input);

    this.moving = false;
    if (!this.controlled) {
      const a = input.axis();
      this.moving = a.x !== 0 || a.y !== 0;
      this.x += a.x * this.speed * this.moveFactor * dt;
      this.y += a.y * this.speed * this.moveFactor * dt;
    }
    this.x += this.ix * dt;
    this.y += this.iy * dt;
    const k = Math.exp(-10 * dt);
    this.ix *= k;
    this.iy *= k;
    w.clampArena(this, this.radius);
  }

  interp(a: number): void {
    this.rx = this.px + (this.x - this.px) * a;
    this.ry = this.py + (this.y - this.py) * a;
  }

  drawGround(r: Renderer): void {
    r.shadow(this.rx, this.ry, 19);
    // anel na cor da classe: mantém o jogador legível sobre o piso escuro
    r.ctx.globalAlpha = 0.55;
    r.ellipse(this.rx, this.ry, 0, 23, null, this.burning ? '#ff7a3c' : this.def.color, 2);
    r.ctx.globalAlpha = 1;
  }

  draw(r: Renderer): void {
    if (this.hurt > 0 && Math.floor(this.t * 28) % 2 === 0) return; // pisca ao tomar dano
    this.kit.draw(r, this);
    // chamas sutis enquanto queima
    if (this.burning) r.glow(this.rx, this.ry, 34, 26 + 5 * Math.sin(this.t * 16), '#ff6a14', 0.22);
  }
}
