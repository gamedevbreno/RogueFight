import type { Input } from '../core/Input';
import { Ring } from '../fx/Fx';
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

const ICE = '#68e8ff';
const ICE_SHIELD_CD = 12;

export class Player {
  x = 0; y = 0; z = 0; // z > 0 só durante saltos (Salto Sísmico da Guerreira)
  px = 0; py = 0; pz = 0; // posição no passo anterior (interpolação)
  rx = 0; ry = 0; rz = 0; // posição interpolada para render
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
  /** Queimadura (Fase 2): segundos restantes. */
  burnT = 0;
  private burnAcc = 0;
  /** Calafrio (Fase 3): -20% de velocidade de movimento e de ataque. */
  chillT = 0;
  /** Casca de Titã: escudo temporário que reduz o dano recebido. */
  guardT = 0;
  /** Revide Brutal: o próximo golpe de martelo sai energizado. */
  empowered = false;
  /** Armadura de Cristal: escudo de gelo que bloqueia 1 golpe; recarrega a cada 12s. */
  iceShield = false;
  private iceShieldT = ICE_SHIELD_CD;
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

  // ---------- status no jogador ----------
  /** Aplica (ou renova) a Queimadura. */
  ignite(seconds: number): void {
    this.burnT = Math.max(this.burnT, seconds);
  }

  get burning(): boolean {
    return this.burnT > 0;
  }

  /** Aplica (ou renova) o Calafrio. A carta Armadura de Cristal dá imunidade. */
  inflictChill(seconds = 2.5): void {
    if (this.up('ice_armor')) return;
    this.chillT = Math.max(this.chillT, seconds);
  }

  get chilled(): boolean {
    return this.chillT > 0;
  }

  /** Casca de Titã: liga o escudo (o Ariete e o Terremoto chamam isto). */
  guard(seconds: number): void {
    if (this.up('juggernaut')) this.guardT = Math.max(this.guardT, seconds);
  }

  /** Multiplicador do dano recebido enquanto o escudo da Casca de Titã está ativo. */
  get guardMult(): number {
    const n = this.up('juggernaut');
    return this.guardT > 0 && n ? 1 - Math.min(0.85, 0.4 + 0.15 * (n - 1)) : 1;
  }

  /** O escudo de gelo absorve o golpe, quebra e congela quem está por perto. */
  breakIceShield(w: World): void {
    this.iceShield = false;
    this.iceShieldT = ICE_SHIELD_CD;
    this.iframes = Math.max(this.iframes, 0.5);
    w.fx.push(new Ring(this.x, this.y, 20, 200, 0.4, ICE, 7, true));
    w.particles.burst(this.x, this.y, 30, 26, ICE, 380, { up: 300, size: 6 });
    w.sfx.play('detonate');
    for (const e of w.enemiesInCircle(this.x, this.y, 200)) e.applyStun(1.2);
  }

  /** Multiplicador de dano de fogo recebido (carta Sangue de Salamandra: -70%). */
  get fireResist(): number {
    return this.up('salamander') ? 0.3 : 1;
  }

  /** Frenesi do Abismo: +20%/nível de dano e velocidade de ataque a cada 30% de vida faltando. */
  private get berserk(): number {
    const n = this.up('berserk');
    if (!n) return 1;
    const missing = 1 - Math.max(0, this.hp) / this.stats.maxHp;
    return 1 + 0.2 * n * (missing / 0.3);
  }

  /** Sangue de Salamandra (+25% enquanto queima) e Calafrio (-20%). */
  private get tempo(): number {
    return (this.burning && this.up('salamander') ? 1.25 : 1) * (this.chilled ? 0.8 : 1);
  }

  /** Velocidade de ataque efetiva (os kits usam este valor, não stats.haste direto). */
  get haste(): number {
    return this.stats.haste * this.tempo * this.berserk;
  }

  /** Velocidade de movimento efetiva. O dash dos kits tem velocidade própria e não é afetado. */
  get speed(): number {
    return this.stats.speed * this.tempo;
  }

  onKill(): void {
    if (this.stats.killHeal) this.heal(this.stats.killHeal);
  }

  /**
   * Dano do jogador: aplica multiplicadores, rola crítico e os efeitos de status.
   * `o.mult` é um multiplicador extra do golpe; `o.forceCrit` garante o crítico.
   * Retorna true se matou.
   */
  hit(w: World, e: Enemy, base: number, o: HitOpts = {}): boolean {
    let dmg = base * this.stats.damage * this.berserk * (o.mult ?? 1);
    const tort = this.up('torturer');
    if (tort) dmg *= 1 + 0.18 * tort * e.statusCount(); // Torturador: +18% por efeito no alvo
    const frost = this.up('permafrost');
    if (frost && (e.slowT > 0 || e.stunT > 0)) dmg *= 1 + 0.2 * frost; // Geada Cortante
    const crit = o.forceCrit || Math.random() < this.stats.crit;
    if (crit) dmg *= 2;
    const killed = w.damageEnemy(e, Math.max(1, Math.round(dmg)), { ...o, crit });
    if (killed || !e.active) return killed;
    this.procs(w, e, o);
    return e.dead || this.shatter(w, e);
  }

  /** Estilhaçar: executa inimigos quase mortos que estejam sob algum efeito de status. */
  private shatter(w: World, e: Enemy): boolean {
    if (!this.up('shatter') || !e.active || e.statusCount() === 0) return false;
    if (e.hp / e.maxHp >= (e.bossName ? 0.06 : 0.18)) return false;
    w.fx.push(new Ring(e.x, e.y, e.radius, e.radius * 4, 0.35, ICE, 6, true));
    w.particles.burst(e.x, e.y, e.height * 0.5, 24, '#e8fbff', 420, { up: 320, size: 6 });
    return w.damageEnemy(e, Math.ceil(e.hp), { color: ICE, heavy: true });
  }

  /** Cartas de status: cada golpe rola a chance de cada efeito. */
  private procs(w: World, e: Enemy, o: HitOpts): void {
    const d = this.stats.damage;
    const roll = (id: string, base: number, perLevel: number): boolean => {
      const n = this.up(id);
      return n > 0 && Math.random() < base + perLevel * (n - 1);
    };
    if (this.up('permafrost')) e.slowT = Math.max(e.slowT, 1.6); // lentidão glacial
    if (roll('ignite', 0.25, 0.15)) e.applyBurn(6 * d, 3);
    if (roll('venom', 0.3, 0.15)) e.applyPoison(3 * d);
    if (o.shock && roll('neural', 0.25, 0.12)) {
      e.applyStun(0.9);
      e.slowT = Math.max(e.slowT, 0.9 + 2.5); // lentidão forte depois da paralisia
    }
    // os que aplicam Sangramento ficam por último: a Hemorragia pode matar o alvo
    if (o.hammer && roll('concuss', 0.35, 0.15)) {
      e.applyStun(0.8);
      e.applyBleed(w, 4 * d, Math.round(34 * d));
    }
    if (e.active && o.barbed && roll('barbed', 0.35, 0.15)) {
      e.applyPoison(3 * d);
      e.applyBleed(w, 4 * d, Math.round(34 * d));
    }
    if (e.active && o.bleed && roll('serrated', 0.35, 0.2)) e.applyBleed(w, 4 * d, Math.round(34 * d));
  }

  update(dt: number, w: World, input: Input): void {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.t += dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurt > 0) this.hurt -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.secCd > 0) this.secCd -= dt;
    if (this.chillT > 0) {
      this.chillT -= dt;
      if (Math.random() < dt * 14) w.particles.burst(this.x, this.y, 34, 1, Math.random() < 0.4 ? '#ffffff' : ICE, 40, { up: 30, g: 120, size: 4 });
    }
    if (this.guardT > 0) this.guardT -= dt;
    if (this.up('ice_armor') && !this.iceShield && (this.iceShieldT -= dt) <= 0) {
      this.iceShield = true;
      w.fx.push(new Ring(this.x, this.y, 60, 26, 0.3, ICE, 4));
    }
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
    this.rz = this.pz + (this.z - this.pz) * a;
  }

  drawGround(r: Renderer): void {
    r.shadow(this.rx, this.ry, 19, this.rz);
    // anel na cor da classe: mantém o jogador legível sobre o piso escuro
    const ring = this.burning ? '#ff7a3c' : this.chilled ? ICE : this.def.color;
    r.ctx.globalAlpha = 0.55;
    r.ellipse(this.rx, this.ry, 0, 23, null, ring, 2);
    if (this.guardT > 0) r.ellipse(this.rx, this.ry, 0, 31, null, '#ffb830', 3); // Casca de Titã
    if (this.iceShield) r.ellipse(this.rx, this.ry, 0, 37, null, ICE, 2.5); // Armadura de Cristal
    r.ctx.globalAlpha = 1;
  }

  draw(r: Renderer): void {
    if (this.hurt > 0 && Math.floor(this.t * 28) % 2 === 0) return; // pisca ao tomar dano
    this.kit.draw(r, this);
    // chamas sutis enquanto queima; névoa fria no Calafrio
    if (this.burning) r.glow(this.rx, this.ry, this.rz + 34, 26 + 5 * Math.sin(this.t * 16), '#ff6a14', 0.22);
    if (this.chilled) r.glow(this.rx, this.ry, this.rz + 34, 28 + 3 * Math.sin(this.t * 6), ICE, 0.2);
    if (this.iceShield) r.glow(this.rx, this.ry, this.rz + 34, 40, ICE, 0.1);
  }
}
