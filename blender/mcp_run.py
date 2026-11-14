"""Executa um script desta pasta dentro do Blender aberto, pelo socket do addon Blender MCP.

    python blender/mcp_run.py blade.py             # renderiza a spritesheet final
    python blender/mcp_run.py blade.py --preview   # só a folha de conferência (pasta temporária)
    python blender/mcp_run.py --info               # lista os objetos da cena

Sem o Blender aberto, o mesmo script roda em modo headless:
    blender -b --factory-startup --python blender/blade.py
"""
import json
import os
import socket
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def call(cmd_type, params=None, timeout=1800):
    s = socket.create_connection(("127.0.0.1", 9876), timeout=10)
    s.settimeout(timeout)
    s.sendall(json.dumps({"type": cmd_type, "params": params or {}}).encode("utf-8"))
    buf = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
        try:
            data = json.loads(buf.decode("utf-8"))
            s.close()
            return data
        except ValueError:
            continue
    s.close()
    return json.loads(buf.decode("utf-8"))


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = sys.argv[1:]
    if not args or args[0] == "--info":
        res = call("get_scene_info")
    else:
        path = os.path.join(HERE, args[0])
        code = (f"__file__ = {path!r}\nPREVIEW = {'--preview' in args}\n"
                "exec(compile(open(__file__, encoding='utf-8').read(), __file__, 'exec'))\n")
        res = call("execute_code", {"code": code})

    if res.get("status") == "error":
        print("ERRO:", res.get("message"))
        sys.exit(1)
    out = res.get("result")
    if isinstance(out, dict) and "result" in out:
        print(out["result"])
    else:
        print(json.dumps(out, indent=1, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
