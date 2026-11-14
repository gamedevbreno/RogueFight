# Modelos e sprites (Blender)

Todos os modelos do jogo são **gerados por script**: cada arquivo desta pasta recria um
modelo do zero (malhas, materiais toon, juntas e poses) e renderiza a spritesheet em
`public/sprites/`. Não há `.blend` versionado — o script é a fonte.

| Script | Saída |
|---|---|
| `blade.py` | `player_blade.png` (idle, run, attack, dash) |
| `sword.py` | `weapon_blade.png` (espada vista de cima) |
| `mage.py` | `player_mage.png` (idle, run, cast) |
| `chaser.py` | `enemy_chaser.png` (chase, windup, lunge) |
| `shooter.py` | `enemy_shooter.png` (float, charging) |
| `tank.py` | `enemy_tank.png` (walk, leap, slam) |
| `bomber.py` | `enemy_bomber.png` (walk, throw) |
| `boss.py` | `enemy_boss.png` (walk, slash, cast, slam) |
| `arena.py` | `arena_tile.png`, `arena_wall.png`, `arena_pillar.png` |

`rf.py` é a biblioteca compartilhada: cena EEVEE com fundo transparente, câmera
ortográfica a 48,7° (cos = 0,66 = `TILT` do jogo), material toon
(`ShaderToRGB` + `ColorRamp` constante), contorno por Inverted Hull e montagem das sheets.

## Como renderizar

Com o Blender aberto e o addon Blender MCP ativo (porta 9876):

```bash
python blender/mcp_run.py boss.py            # sheet final
python blender/mcp_run.py boss.py --preview  # folha de conferência na pasta temporária
```

Sem abrir o Blender (headless):

```bash
blender -b --factory-startup --python blender/boss.py
```

Depois de renderizar, compacte os PNGs (Python do sistema + Pillow):

```bash
python blender/optimize.py
```

## Direções

Cada sheet de personagem tem 5 grupos de direção, um bloco de linhas por grupo
(`rf.DIRS`): Leste, Sudeste, Sul (frente), Nordeste e Norte (costas). Oeste, Sudoeste e
Noroeste são espelhamentos feitos no jogo, o que dá 8 direções reais. A função
`facing(ang)` em `src/render/Sprites.ts` faz a conversão de ângulo para grupo + flip.

Se mudar tamanho de célula, `ortho` ou `tz` de um script, o render imprime a nova âncora
e o `px/unit`; atualize a entrada correspondente em `SHEETS` (`src/render/Sprites.ts`).
