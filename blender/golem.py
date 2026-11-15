"""Colosso de Gelo (Fase 3): o corpo do Golem de Magma em gelo, com cristais nos ombros."""
import os

VARIANT = "ice"
_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "brute.py")
_code = compile(open(_src, encoding="utf-8").read(), _src, "exec")
exec(_code)
