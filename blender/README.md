# Modelos e sprites (Blender)

Todos os modelos do jogo são **gerados por script**: cada arquivo desta pasta recria um
modelo do zero (malhas, materiais toon, juntas e poses) e renderiza a spritesheet em
`public/sprites/`. Não há `.blend` versionado — o script é a fonte.

| Script | Saída |
|---|---|
| `blade.py` | `player_blade.png` — Lâmina Espectral (idle, run, attack, dash) |
| `sword.py` | `weapon_blade.png` (espada vista de cima) |
| `mage.py` | `player_mage.png` — Arcanista (idle, run, cast) |
| `warrior.py` | `player_warrior.png` — Valquíria de Ferro (idle, run, attack, dash) |
| `hammer.py` | `weapon_hammer.png` (martelo de guerra visto de cima) |
| `archer.py` | `player_archer.png` — Caçador Astral (idle, run, shoot, dash) |
| `chaser.py` | `enemy_chaser.png` (chase, windup, lunge) |
| `shooter.py` | `enemy_shooter.png` (float, charging) |
| `tank.py` | `enemy_tank.png` (walk, leap, slam) |
| `bomber.py` | `enemy_bomber.png` (walk, throw) |
| `boss.py` | `enemy_boss.png` (walk, slash, cast, slam) |
| `arena.py` | `arena_tile.png`, `arena_wall.png`, `arena_pillar.png` |
| **Fase 2 — Cratera Vulcânica** | |
| `hellhound.py` | `enemy_hellhound.png` — Salamandra Ígnea (chase, windup, lunge) |
| `pyromancer.py` | `enemy_pyromancer.png` — Piromante Cinzento (float, charging) |
| `brute.py` | `enemy_brute.png` — Golem de Magma (walk, pound) |
| `fireboss.py` | `enemy_fireboss.png` — Senhor das Cinzas (walk, wave, cast) |
| `arena_fire.py` | `arena_fire_tile.png`, `arena_fire_wall.png`, `arena_fire_pillar.png` |

| **Fase 3 — Cidadela Glacial** | |
| `stalker.py` | `enemy_stalker.png` — Lobo Glacial (chase, windup, lunge) |
| `cryomancer.py` | `enemy_cryomancer.png` — Tecelã de Cristal (float, charging) |
| `golem.py` | `enemy_golem.png` — Colosso de Gelo (walk, pound) |
| `ice_boss.py` | `enemy_ice_boss.png` — Soberano do Inverno (walk, cast, slam) |
| `arena_ice.py` | `arena_ice_tile.png`, `arena_ice_wall.png`, `arena_ice_pillar.png` |

### Variantes

Alguns scripts são só um *wrapper* que define uma variável e executa outro script, que
troca paleta e detalhes do modelo mantendo a anatomia e as animações:

| Wrapper | Executa | Variável |
|---|---|---|
| `stalker.py` | `chaser.py` | `VARIANT = "ice"` (lobo: orelhas no lugar dos chifres, crista de cristais) |
| `golem.py` | `brute.py` | `VARIANT = "ice"` (gelo maciço, cristais nos ombros) |
| `ice_boss.py` | `boss.py` | `VARIANT = "ice"` (coroa de gelo, asas de cristal, sem halo) |
| `arena_fire.py` / `arena_ice.py` | `arena.py` | `THEME = "fire"` / `"ice"` |

`arena_fire.py` só define `THEME = "fire"` e executa `arena.py`: a geometria é a mesma e a
paleta vem do dicionário `PAL` (basalto, rachaduras de magma, cristais em brasa).

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

## Ícones do PWA

`make_icons.py` não usa o Blender: monta os ícones do app a partir das sheets já
renderizadas (os dois heróis sobre fundo escuro com borda neon).

```bash
python blender/make_icons.py   # public/icon-192.png, icon-512.png, apple-touch-icon.png
```

## Direções

Cada sheet de personagem tem 5 grupos de direção, um bloco de linhas por grupo
(`rf.DIRS`): Leste, Sudeste, Sul (frente), Nordeste e Norte (costas). Oeste, Sudoeste e
Noroeste são espelhamentos feitos no jogo, o que dá 8 direções reais. A função
`facing(ang)` em `src/render/Sprites.ts` faz a conversão de ângulo para grupo + flip.

Se mudar tamanho de célula, `ortho` ou `tz` de um script, o render imprime a nova âncora
e o `px/unit`; atualize a entrada correspondente em `SHEETS` (`src/render/Sprites.ts`).
