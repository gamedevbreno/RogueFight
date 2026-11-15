"""Arena da Fase 3 (Cidadela Glacial): mesma geometria de arena.py com a paleta de gelo."""
import os

THEME = "ice"
_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arena.py")
exec(compile(open(_src, encoding="utf-8").read(), _src, "exec"))
