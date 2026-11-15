import { SHEETS } from '../../render/Sprites';
import { Chaser } from './Chaser';

const COLOR = '#8fdcff';

/**
 * Lobo Glacial (Fase 3): desliza rápido e emenda DOIS botes seguidos, remirando entre eles.
 * Cada acerto pode aplicar Calafrio no jogador.
 */
export class FrostStalker extends Chaser {
  protected sheet = SHEETS.stalker;
  protected lungeSpeed = 640;
  protected lungeTime = 0.22;
  protected lungeCount = 2;
  protected damage = 8;
  protected chillChance = 0.3;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, hpScale, { hp: 34 * hpScale, radius: 16, speed: 250, color: COLOR, knockMul: 0.9, height: 44 });
  }
}
