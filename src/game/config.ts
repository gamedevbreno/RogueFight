/** Achatamento do eixo Y do chão: simula a câmera top-down inclinada. */
export const TILT = 0.66;
/** Altura lógica da tela; a largura se adapta ao aspect ratio da janela. */
export const VIEW_H = 780;
/** Passo fixo da simulação (60 Hz), independente da taxa do monitor. */
export const FIXED_DT = 1 / 60;
/** Arena centrada na origem. */
export const ARENA = { w: 1800, h: 1300 };
export const TOTAL_WAVES = 5;

export const ELEMENTS = [
  { name: 'Brasa', color: '#ff7a3c' },
  { name: 'Geada', color: '#5ad8ff' },
  { name: 'Raio', color: '#ffe14a' },
] as const;

export const FONT = '"Segoe UI", system-ui, sans-serif';
