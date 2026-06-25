from __future__ import annotations

import importlib.util
import sys
import threading
import webbrowser
from collections import deque
from pathlib import Path
from typing import Callable
from wsgiref.simple_server import make_server


def load_socketio_module():
    try:
        import socketio as module  # type: ignore
        if hasattr(module, "Server") and hasattr(module, "WSGIApp"):
            return module
    except Exception:
        pass

    version_dir = f"python{sys.version_info.major}.{sys.version_info.minor}"
    candidate = Path(sys.base_prefix) / "lib" / version_dir / "site-packages" / "socketio" / "__init__.py"
    if not candidate.exists():
        raise RuntimeError(
            "python-socketio is installed incorrectly in the current environment and no fallback system package was found."
        )

    spec = importlib.util.spec_from_file_location(
        "_mopengine_socketio",
        candidate,
        submodule_search_locations=[str(candidate.parent)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load python-socketio from {candidate}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    sys.modules["socketio"] = module
    spec.loader.exec_module(module)
    if not hasattr(module, "Server") or not hasattr(module, "WSGIApp"):
        raise RuntimeError(f"Loaded socketio module from {candidate}, but it does not expose Server/WSGIApp")
    return module


socketio = load_socketio_module()


class SocketIOViewerServer:
    def __init__(
        self,
        *,
        html_path: Path,
        snapshot_event: str,
        stream_event: str,
        history_limit: int,
        thread_name: str,
    ) -> None:
        self._html_path = html_path
        self._snapshot_event = snapshot_event
        self._stream_event = stream_event
        self._entries: deque[dict] = deque(maxlen=history_limit)
        self._lock = threading.Lock()
        self._sio = socketio.Server(
            async_mode="threading",
            cors_allowed_origins="*",
            allow_upgrades=False,
        )
        self._sio.on("connect", self._on_connect)
        self._app = socketio.WSGIApp(self._sio, self._serve_http)
        self._server = make_server("127.0.0.1", 0, self._app)
        self._thread = threading.Thread(target=self._server.serve_forever, name=thread_name, daemon=True)
        self.url = f"http://127.0.0.1:{self._server.server_port}/"

    def start(self) -> None:
        self._thread.start()

    def shutdown(self) -> None:
        self._server.shutdown()
        self._thread.join(timeout=1.0)

    def emit_entries(self, entries: list[dict]) -> None:
        if not entries:
            return

        with self._lock:
            self._entries.extend(entries)

        self._sio.emit(self._stream_event, entries)

    def _on_connect(self, sid, environ) -> None:
        with self._lock:
            snapshot = list(self._entries)
        self._sio.emit(self._snapshot_event, snapshot, to=sid)

    def _serve_http(self, environ, start_response):
        if environ.get("PATH_INFO", "/") == "/":
            content = self._html_path.read_bytes()
            start_response(
                "200 OK",
                [
                    ("Content-Type", "text/html; charset=utf-8"),
                    ("Content-Length", str(len(content))),
                    ("Cache-Control", "no-store"),
                ],
            )
            return [content]

        start_response("404 Not Found", [("Content-Type", "text/plain; charset=utf-8")])
        return [b"Not Found"]


def start_viewer_server(factory: Callable[[], SocketIOViewerServer]) -> SocketIOViewerServer:
    server = factory()
    server.start()
    return server


def open_log_viewer(url: str) -> None:
    webbrowser.open_new_tab(url)
