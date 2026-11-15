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
  minStage?: number; // só aparece a partir desta fase
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

  // ---- cartas de efeitos de status (a partir da Fase 2) ----
  { id: 'ignite', name: 'Toque Ígneo', desc: 'Ataques têm 25% (+15%/nível) de chance de aplicar Queimadura.', icon: '♨', max: 3, minStage: 2 },
  { id: 'venom', name: 'Peçonha Abissal', desc: 'Ataques têm 30% (+15%/nível) de chance de aplicar Veneno acumulativo (até 5).', icon: '☣', max: 3, minStage: 2 },
  { id: 'serrated', name: 'Fio Serrilhado', desc: 'Cortes e estocadas têm 35% (+20%/nível) de chance de Sangramento; 3 acúmulos estouram uma Hemorragia.', icon: '⚔', max: 3, cls: 'blade', minStage: 2 },
  { id: 'neural', name: 'Sobrecarga Neural', desc: 'Orbes e detonações têm 25% (+12%/nível) de chance de Paralisar por 0,9s, seguido de lentidão forte.', icon: '⚡', max: 3, cls: 'mage', minStage: 2 },
  { id: 'salamander', name: 'Sangue de Salamandra', desc: '−70% de dano de Lava e Queimadura; +25% de velocidade de movimento e ataque enquanto você queima.', icon: '❂', max: 1, minStage: 2 },
  { id: 'epidemic', name: 'Epidemia', desc: 'Inimigos que morrem sob efeito de status espalham seus efeitos para os inimigos próximos.', icon: '✣', max: 1, minStage: 2 },
  { id: 'torturer', name: 'Torturador', desc: '+18% de dano para cada efeito negativo diferente ativo no alvo.', icon: '⛓', max: 2, minStage: 2 },

  // ---- Valquíria de Ferro ----
  { id: 'aftershock', name: 'Abalo Sísmico', desc: 'O 3º golpe do combo e o Salto Sísmico deixam fissuras que explodem de novo após 0,45s.', icon: '≋', max: 3, cls: 'warrior' },
  { id: 'juggernaut', name: 'Casca de Titã', desc: 'Usar o Ariete ou o Terremoto dá um escudo de 3s que reduz 40% (+15%/nível) do dano recebido.', icon: '⛨', max: 3, cls: 'warrior' },
  { id: 'vortex', name: 'Gravidade Esmagadora', desc: 'O Salto Sísmico puxa os inimigos próximos para o centro da cratera antes do impacto.', icon: '◍', max: 2, cls: 'warrior' },
  { id: 'shockwave', name: 'Martelo Trovejante', desc: '+22% de alcance e raio nos golpes de martelo e nas ondas de choque.', icon: '⚒', max: 3, cls: 'warrior' },
  { id: 'retaliate', name: 'Revide Brutal', desc: 'Usar o Ariete ou sofrer dano energiza o próximo golpe de martelo: +60% de dano por nível e crítico garantido.', icon: '↯', max: 2, cls: 'warrior' },
  { id: 'concuss', name: 'Esmagamento Craniano', desc: 'Golpes de martelo têm 35% (+15%/nível) de chance de Paralisar por 0,8s e aplicar Sangramento.', icon: '✸', max: 3, cls: 'warrior', minStage: 2 },

  // ---- Caçador Astral ----
  { id: 'splitshot', name: 'Tiro Duplo', desc: 'Cada disparo principal lança +1 flecha adicional em cone estreito.', icon: '⫸', max: 2, cls: 'archer' },
  { id: 'bounce_arrow', name: 'Flecha Ricocheteante', desc: 'Flechas ricocheteiam para +1 inimigo próximo por nível.', icon: '⤳', max: 3, cls: 'archer' },
  { id: 'deadeye', name: 'Olho de Águia', desc: '+25% de dano por nível contra inimigos a mais de 240 unidades de distância.', icon: '◎', max: 3, cls: 'archer' },
  { id: 'rain_plus', name: 'Tempestade de Flechas', desc: '+25% de raio e +2 ondas de impacto na Chuva de Flechas.', icon: '☔', max: 3, cls: 'archer' },
  { id: 'vault_shot', name: 'Disparo Acrobático', desc: 'A Acrobacia dispara +2 flechas por nível e reduz em 1s a recarga da Chuva de Flechas.', icon: '➶', max: 2, cls: 'archer' },
  { id: 'barbed', name: 'Pontas Envenenadas', desc: 'Flechas têm 35% (+15%/nível) de chance de aplicar Veneno e Sangramento juntos.', icon: '☠', max: 3, cls: 'archer', minStage: 2 },

  // ---- universais de fim de jogo (a partir da Fase 3) ----
  { id: 'permafrost', name: 'Geada Cortante', desc: 'Ataques aplicam lentidão glacial e causam +20%/nível de dano contra inimigos lentos ou paralisados.', icon: '❄', max: 3, minStage: 3 },
  { id: 'ice_armor', name: 'Armadura de Cristal', desc: 'Imune ao Calafrio; a cada 12s gera um Escudo de Gelo que bloqueia 1 golpe e congela os inimigos próximos ao quebrar.', icon: '❖', max: 1, minStage: 3 },
  { id: 'shatter', name: 'Estilhaçar', desc: 'Inimigos comuns abaixo de 18% de vida (chefes: 6%) sob qualquer efeito de status são executados numa explosão de gelo.', icon: '✴', max: 1, minStage: 3 },
  { id: 'berserk', name: 'Frenesi do Abismo', desc: '+20% de dano e velocidade de ataque por nível para cada 30% de vida máxima que estiver faltando.', icon: '☄', max: 2, minStage: 3 },
];

/** Sorteia n cartas: garante ao menos 1 da classe (sinergia) e completa com o resto do pool. */
export function rollUpgrades(p: Player, stage: number, n = 3): Upgrade[] {
  const ok = UPGRADES.filter((u) => (!u.cls || u.cls === p.def.id) && p.up(u.id) < u.max && (u.minStage ?? 1) <= stage);
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
