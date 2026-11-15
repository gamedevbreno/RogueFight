"""Lobo Glacial (Fase 3): mesma anatomia e animações do perseguidor, em gelo."""
import os

VARIANT = "ice"
_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chaser.py")
_code = compile(open(_src, encoding="utf-8").read(), _src, "exec")
exec(_code)
