import type { Input } from '../../core/Input';
import type { Renderer } from '../../render/Renderer';
import type { Player } from '../Player';
import type { World } from '../World';

export type ClassId = 'blade' | 'mage';

/**
 * Kit de classe: encapsula ataque primário, dash e habilidade secundária.
 * O Player cuida do que é comum (movimento, vida, i-frames, cooldowns) e
 * delega o resto ao kit — adicionar uma classe nova = implementar esta interface.
 */
export interface ClassKit {
  update(dt: number, p: Player, w: World, input: Input): void;
  draw(r: Renderer, p: Player): void;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  color: string;
  hp: number;
  speed: number;
  dashName: string;
  secName: string;
  abilities: { key: string; text: string }[];
  create(): ClassKit;
}
