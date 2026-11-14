/** Achatamento do eixo Y do chão: simula a câmera top-down inclinada. */
export const TILT = 0.66;
/** Altura lógica da tela; a largura se adapta ao aspect ratio da janela. */
export const VIEW_H = 780;
/** Passo fixo da simulação (60 Hz), independente da taxa do monitor. */
export const FIXED_DT = 1 / 60;
/** Arena centrada na origem. */
export const ARENA = { w: 1800, h: 1300 };
/** Cada fase tem 10 ondas; a última de cada fase é um chefe. */
export const STAGE_WAVES = 10;
export const TOTAL_WAVES = 20;
export const STAGE_NAMES = ['Ruínas Arcanas', 'Cratera Vulcânica'];
/** Fase (1 ou 2) de uma onda global (1..20). */
export const stageOf = (wave: number): number => Math.min(STAGE_NAMES.length, Math.ceil(wave / STAGE_WAVES));
/** Número da onda dentro da fase (1..10). */
export const stageWave = (wave: number): number => ((wave - 1) % STAGE_WAVES) + 1;

/** Cores dos efeitos de status (números de dano, ícones e partículas). */
export const STATUS = { burn: '#ff7a3c', poison: '#5cff7a', bleed: '#ff3b5c', stun: '#ffe14a' };

export const ELEMENTS = [
  { name: 'Brasa', color: '#ff7a3c' },
  { name: 'Geada', color: '#5ad8ff' },
  { name: 'Raio', color: '#ffe14a' },
] as const;

export const FONT = '"Segoe UI", system-ui, sans-serif';
