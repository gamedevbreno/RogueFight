"""Soberano do Inverno (Boss da Fase 3): o corpo do Arconte em armadura glacial, com coroa de gelo e asas de cristal."""
import os

VARIANT = "ice"
_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "boss.py")
_code = compile(open(_src, encoding="utf-8").read(), _src, "exec")
exec(_code)
