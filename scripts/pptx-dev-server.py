"""Run the Vercel-style PPTX handler locally for development."""

from http.server import HTTPServer
from importlib import util
from pathlib import Path
import os


ROOT_DIR = Path(__file__).resolve().parents[1]


def load_env_file(path):
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in ("'", '"')
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


def load_pptx_handler():
    module_path = ROOT_DIR / "api" / "pptx.py"
    spec = util.spec_from_file_location("pptx_api", module_path)
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.handler


if __name__ == "__main__":
    load_env_file(ROOT_DIR / ".env.local")
    port = int(os.environ.get("PPTX_DEV_PORT", "3002"))
    server = HTTPServer(("127.0.0.1", port), load_pptx_handler())
    print(f"PPTX dev server listening on http://127.0.0.1:{port}/api/pptx")
    server.serve_forever()
