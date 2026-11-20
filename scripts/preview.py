from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FILES = {"index.html", "catch-the-star.html", "index.html.index.html", "pro.html"}


class ArcadeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        requested = unquote(urlsplit(self.path).path).lstrip("/")
        resolved = (ROOT / (requested or "index.html")).resolve()
        if not resolved.is_file() or (
            resolved not in [ROOT / name for name in PUBLIC_FILES]
            and not resolved.is_relative_to(ROOT / "assets")
        ):
            self.send_error(404)
            return None
        return super().send_head()


parser = ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=3000)
parser.add_argument("--strictPort", action="store_true")
options = parser.parse_args()
with ThreadingHTTPServer((options.host, options.port), ArcadeHandler) as server:
    print(f"Gamefor Ffun is available on http://{options.host}:{options.port}/", flush=True)
    server.serve_forever()
