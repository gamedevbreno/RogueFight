import { shuffle } from '../core/math';
import type { ClassId } from './classes/ClassKit';
import type { Player } from './Player';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
  cls?: ClassId; // ausente = universal
  /** Efeito imediato em stats. Upgrades de comportamento são lidos pelos kits via player.up(id). */
  apply?: (p: Player) => void;
}

export const UPGRADES: Upgrade[] = [
  // ---- universais ----
  { id: 'vigor', name: 'Vigor', desc: '+25 de vida máxima e cura 25.', icon: '✚', max: 5,
    apply: (p) => { p.stats.maxHp += 25; p.heal(25); } },
  { id: 'power', name: 'Fúria', desc: '+15% de dano.', icon: '▲', max: 5,
    apply: (p) => { p.stats.damage += 0.15; } },
  { id: 'haste', name: 'Celeridade', desc: '+14% de velocidade de ataque.', icon: '»', max: 5,
    apply: (p) => { p.stats.haste += 0.14; } },
  { id: 'swift', name: 'Passos Leves', desc: '+10% de velocidade de movimento.', icon: '➤', max: 4,
    apply: (p) => { p.stats.speed *= 1.1; } },
  { id: 'reflex', name: 'Reflexos', desc: '−18% de recarga do dash.', icon: '◈', max: 4,
    apply: (p) => { p.stats.dashCd *= 0.82; } },
  { id: 'focus', name: 'Foco', desc: '−18% de recarga da habilidade secundária.', icon: '◎', max: 4,
    apply: (p) => { p.stats.secCd *= 0.82; } },
  { id: 'crit', name: 'Olho Crítico', desc: '+12% de chance de crítico (dano ×2).', icon: '✦', max: 5,
    apply: (p) => { p.stats.crit += 0.12; } },
  { id: 'siphon', name: 'Sifão Vital', desc: 'Cura 2 de vida a cada abate.', icon: '♥', max: 3,
    apply: (p) => { p.stats.killHeal += 2; } },

  // ---- Lâmina Espectral ----
  { id: 'waves', name: 'Onda Cortante', desc: 'Cada corte lança uma onda de energia perfurante.', icon: '☽', max: 3, cls: 'blade' },
  { id: 'clone', name: 'Eco Espectral', desc: 'O dash deixa um clone que desfere um corte giratório.', icon: '❖', max: 3, cls: 'blade' },
  { id: 'dashcut', name: 'Passo Cortante', desc: 'O dash fere todos os inimigos atravessados.', icon: '⟋', max: 3, cls: 'blade' },
  { id: 'execute', name: 'Perfurar e Renovar', desc: 'Abates com a estocada zeram o dash e cortam 50% da recarga dela.', icon: '⟐', max: 1, cls: 'blade' },
  { id: 'wide', name: 'Lâmina Longa', desc: '+20% de alcance e arco mais amplo nos cortes.', icon: '◠', max: 2, cls: 'blade' },

  // ---- Arcanista ----
  { id: 'ricochet', name: 'Ricochete', desc: 'Orbes saltam para +1 inimigo próximo.', icon: '⤳', max: 3, cls: 'mage' },
  { id: 'multishot', name: 'Orbe Gêmeo', desc: '+1 orbe por disparo.', icon: '⁂', max: 2, cls: 'mage' },
  { id: 'chain', name: 'Reação em Cadeia', desc: 'Inimigos mortos por detonação explodem e detonam os vizinhos.', icon: '✺', max: 3, cls: 'mage' },
  { id: 'mine', name: 'Eco Instável', desc: 'O Blink deixa uma mina arcana que aplica 2 marcas.', icon: '◉', max: 2, cls: 'mage' },
  { id: 'bigblast', name: 'Supernova', desc: '+25% de raio e dano na explosão.', icon: '✹', max: 3, cls: 'mage' },
  { id: 'overmark', name: 'Saturação', desc: 'Orbes aplicam +1 marca por acerto.', icon: '⁘', max: 1, cls: 'mage' },
];

/** Sorteia n cartas: garante ao menos 1 da classe (sinergia) e completa com o resto do pool. */
export function rollUpgrades(p: Player, n = 3): Upgrade[] {
  const ok = UPGRADES.filter((u) => (!u.cls || u.cls === p.def.id) && p.up(u.id) < u.max);
  const cls = shuffle(ok.filter((u) => u.cls));
  const picked: Upgrade[] = [];
  if (cls.length) picked.push(cls[0]);
  const rest = shuffle(ok.filter((u) => !picked.includes(u)));
  while (picked.length < n && rest.length) picked.push(rest.pop()!);
  return shuffle(picked);
}

export function takeUpgrade(p: Player, u: Upgrade): void {
  p.ups.set(u.id, p.up(u.id) + 1);
  u.apply?.(p);
}
