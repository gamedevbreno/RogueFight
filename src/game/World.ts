import type { Sfx } from '../audio/Sfx';
import type { Input } from '../core/Input';
import { clamp, rand } from '../core/math';
import { FloatText, Particles, Ring, type Fx } from '../fx/Fx';
import type { Renderer } from '../render/Renderer';
import { ARENA } from './config';
import type { Enemy } from './enemies/Enemy';
import { LavaPool } from './LavaPool';
import type { Player } from './Player';

/** Objeto de simulação genérico (projéteis, clones, explosões com atraso...). */
export interface Actor {
  x: number;
  y: number;
  dead: boolean;
  /** Perigo pendente no chão (ex.: bomba instável): a onda não termina enquanto existir. */
  hazard?: boolean;
  update(dt: number, w: World): void;
  interp(alpha: number): void;
  drawGround(r: Renderer): void;
  draw(r: Renderer): void;
}

export interface HitOpts {
  dir?: number; // direção do knockback
  knock?: number;
  crit?: boolean;
  color?: string;
  heavy?: boolean;
  dot?: boolean; // dano periódico: sem flash, partículas nem som de impacto
  bleed?: boolean; // golpe cortante: pode aplicar Sangramento (Fio Serrilhado)
  shock?: boolean; // golpe arcano: pode Paralisar (Sobrecarga Neural)
}

/** Ganchos de game feel fornecidos pelo Game (hitstop/shake vivem fora da simulação). */
export interface Feel {
  hitstop(seconds: number): void;
  shake(amount: number): void;
}

export class World {
  enemies: Enemy[] = [];
  actors: Actor[] = [];
  fx: Fx[] = [];
  readonly particles = new Particles();
  time = 0;
  kills = 0;
  damageFlash = 0;
  /** Fase atual (1 = Ruínas Arcanas, 2 = Cratera Vulcânica). Definida pelo Game. */
  stage = 1;
  private lavaT = rand(8, 12);

  constructor(readonly player: Player, readonly sfx: Sfx, private readonly feel: Feel) {}

  hitstop(t: number): void {
    this.feel.hitstop(t);
  }

  shake(a: number): void {
    this.feel.shake(a);
  }

  // ---------- simulação (passo fixo) ----------
  update(dt: number, input: Input): void {
    this.time += dt;
    const p = this.player;
    if (this.stage >= 2 && !p.dead) this.updateLava(dt);
    if (!p.dead) p.update(dt, this, input);
    else {
      p.px = p.x;
      p.py = p.y;
    }

    for (const e of this.enemies) e.update(dt, this);
    this.separate();
    // novos atores criados durante o update entram no próximo passo
    const n = this.actors.length;
    for (let i = 0; i < n; i++) this.actors[i].update(dt, this);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.actors = this.actors.filter((a) => !a.dead);
  }

  /**
   * Fase 2: de tempos em tempos surge uma poça de lava num ponto ALEATÓRIO da arena
   * (não mira o jogador). É rara: no máximo 2 grandes ao mesmo tempo.
   */
  private updateLava(dt: number): void {
    if ((this.lavaT -= dt) > 0) return;
    this.lavaT = rand(15, 20);
    const big = this.actors.filter((a) => a instanceof LavaPool && a.big).length;
    if (big >= 2) return;
    this.actors.push(new LavaPool(rand(-ARENA.w / 2 + 140, ARENA.w / 2 - 140), rand(-ARENA.h / 2 + 140, ARENA.h / 2 - 140)));
  }

  private separate(): void {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (!a.active) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ta = b.radius / min; // o menor cede mais
        a.x -= (dx / d) * push * ta * 2;
        a.y -= (dy / d) * push * ta * 2;
        b.x += (dx / d) * push * (1 - ta) * 2;
        b.y += (dy / d) * push * (1 - ta) * 2;
      }
    }
  }

  clampArena(o: { x: number; y: number }, r: number): void {
    o.x = clamp(o.x, -ARENA.w / 2 + r, ARENA.w / 2 - r);
    o.y = clamp(o.y, -ARENA.h / 2 + r, ARENA.h / 2 - r);
  }

  // ---------- consultas ----------
  enemiesInCircle(x: number, y: number, r: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.active && Math.hypot(e.x - x, e.y - y) < r + e.radius) out.push(e);
    }
    return out;
  }

  nearestEnemy(x: number, y: number, max: number, exclude?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null;
    let bd = max;
    for (const e of this.enemies) {
      if (!e.active || exclude?.has(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ---------- combate ----------
  /** Aplica dano a um inimigo. Retorna true se ele morreu. */
  damageEnemy(e: Enemy, amount: number, o: HitOpts = {}): boolean {
    if (!e.active) return false;
    if (e.poisonT > 0) amount = Math.round(amount * 1.1); // envenenado toma +10% de dano
    e.hp -= amount;
    if (!o.dot) e.flash = 0.1;
    if (o.knock && o.dir !== undefined) {
      e.kvx += Math.cos(o.dir) * o.knock * e.knockMul;
      e.kvy += Math.sin(o.dir) * o.knock * e.knockMul;
    }
    const color = o.crit ? '#ffe14a' : (o.color ?? '#ffffff');
    this.fx.push(new FloatText(
      e.x + rand(-8, 8), e.y, e.z + e.height + 8,
      `${amount}${o.crit ? '!' : ''}`, color, o.crit ? 26 : o.heavy ? 22 : o.dot ? 12 : 16,
    ));
    if (!o.dot) {
      this.particles.burst(e.x, e.y, e.z + e.height * 0.5, o.heavy ? 10 : 4, o.color ?? e.color, o.heavy ? 340 : 210, { dir: o.dir, cone: 0.9 });
      this.sfx.play(o.crit ? 'crit' : 'hit');
    }

    if (e.hp <= 0) {
      e.dead = true;
      this.kills++;
      this.particles.burst(e.x, e.y, e.z + e.height * 0.5, 22, e.color, 380, { life: 0.7, size: 6, up: 320 });
      this.particles.burst(e.x, e.y, e.z + e.height * 0.5, 8, '#ffffff', 260, { life: 0.4 });
      this.fx.push(new Ring(e.x, e.y, e.radius, e.radius * 3.2, 0.3, e.color, 5));
      this.sfx.play('kill');
      this.shake(0.16);
      this.player.onKill();
      if (this.player.up('epidemic') && e.statusCount() > 0) this.spreadStatus(e);
      e.onDeath(this);
      return true;
    }
    return false;
  }

  /** Carta Epidemia: quem morre sob efeito de status contagia os inimigos próximos. */
  private spreadStatus(e: Enemy): void {
    this.fx.push(new Ring(e.x, e.y, e.radius, 180, 0.35, '#5cff7a', 4));
    for (const o of this.enemiesInCircle(e.x, e.y, 180)) {
      if (o === e) continue;
      if (e.burnT > 0) o.applyBurn(e.burn, 3);
      if (e.poisonT > 0) o.applyPoison(e.poison);
      if (e.bleedT > 0) o.addBleedStack(e.bleed);
      if (e.stunT > 0) o.applyStun(0.9);
    }
  }

  /**
   * Aplica um golpe ao jogador. Retorna false se ele estava invulnerável (i-frames).
   * `burnChance`: chance de o golpe também aplicar Queimadura (inimigos de fogo).
   */
  damagePlayer(amount: number, burnChance = 0): boolean {
    const p = this.player;
    if (p.dead || p.iframes > 0) return false;
    p.hp -= amount;
    p.iframes = 0.7;
    p.hurt = 0.7;
    this.damageFlash = 1;
    this.fx.push(new FloatText(p.x, p.y, 60, `-${amount}`, '#ff3b5c', 22));
    this.particles.burst(p.x, p.y, 24, 14, '#ff3b5c', 300);
    this.sfx.play('hurt');
    this.shake(0.6);
    this.hitstop(0.09);
    if (p.hp <= 0) this.killPlayer();
    else if (burnChance && Math.random() < burnChance) p.ignite(2.5);
    return true;
  }

  /** Dano contínuo (lava, queimadura): baixo, sem hitstop, sem i-frames e sem tremer a tela. */
  softDamage(amount: number, color: string): void {
    const p = this.player;
    if (p.dead) return;
    p.hp -= amount;
    this.damageFlash = Math.max(this.damageFlash, 0.3);
    this.fx.push(new FloatText(p.x + rand(-12, 12), p.y, 58, `-${amount}`, color, 14));
    if (p.hp <= 0) this.killPlayer();
  }

  private killPlayer(): void {
    const p = this.player;
    p.hp = 0;
    p.dead = true;
    this.particles.burst(p.x, p.y, 24, 60, p.def.color, 520, { life: 1.1, size: 7, up: 420 });
    this.fx.push(new Ring(p.x, p.y, 20, 260, 0.6, p.def.color, 8));
    this.shake(1);
    this.hitstop(0.25);
  }

  // ---------- render (delta variável) ----------
  updateFx(dt: number): void {
    let n = 0;
    for (const f of this.fx) if (f.update(dt)) this.fx[n++] = f;
    this.fx.length = n;
    this.particles.update(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
  }

  interp(alpha: number): void {
    this.player.interp(alpha);
    for (const e of this.enemies) e.interp(alpha);
    for (const a of this.actors) a.interp(alpha);
  }

  draw(r: Renderer): void {
    const p = this.player;
    // 1) chão: telegraphs, anéis e sombras
    for (const f of this.fx) if (f.ground) f.draw(r);
    for (const a of this.actors) a.drawGround(r);
    for (const e of this.enemies) e.drawGround(r);
    if (!p.dead) p.drawGround(r);

    // 2) entidades ordenadas por Y (profundidade)
    const list: { y: number; draw(r: Renderer): void }[] = [...this.enemies, ...this.actors];
    if (!p.dead) list.push(p);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(r);

    // 3) efeitos por cima
    for (const f of this.fx) if (!f.ground) f.draw(r);
    this.particles.draw(r);
  }
}
