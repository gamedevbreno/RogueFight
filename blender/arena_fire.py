"""Arena da Fase 2 (cratera vulcânica): mesma geometria de arena.py com a paleta de fogo."""
import os

THEME = "fire"
_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arena.py")
exec(compile(open(_src, encoding="utf-8").read(), _src, "exec"))
