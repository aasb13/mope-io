from __future__ import annotations

import threading

from controller.browser_log_pump import start_browser_log_pump
from controller.paths import VIEWER_DIR
from controller.viewer_server import SocketIOViewerServer, start_viewer_server


VIEWER_HTML = VIEWER_DIR / "debug.html"


class DebugLogViewerServer(SocketIOViewerServer):
    def __init__(self, max_logs: int = 5000) -> None:
        super().__init__(
            html_path=VIEWER_HTML,
            snapshot_event="snapshot",
            stream_event="logs",
            history_limit=max_logs,
            thread_name="debug-log-viewer",
        )


def start_debug_log_viewer_server() -> DebugLogViewerServer:
    return start_viewer_server(DebugLogViewerServer)


def start_debug_log_pump(driver, batch_callback=None) -> tuple[threading.Event, list[threading.Thread]]:
    return start_browser_log_pump(
        driver,
        collect_script="""
        const logs = Array.isArray(window.__mopEngineDebugLogs)
            ? window.__mopEngineDebugLogs.splice(0, window.__mopEngineDebugLogs.length)
            : [];
        return logs;
        """,
        normalize_entries=lambda entries: [entry for entry in entries if isinstance(entry, dict)]
        if isinstance(entries, list)
        else [],
        emit_batch=batch_callback,
        collect_thread_name="debug-log-collect",
        emit_thread_name="debug-log-output",
    )
