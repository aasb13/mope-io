from __future__ import annotations

from controller.paths import VIEWER_DIR
from controller.viewer_server import SocketIOViewerServer, open_log_viewer, start_viewer_server


VIEWER_HTML = VIEWER_DIR / "index.html"


class PacketLogViewerServer(SocketIOViewerServer):
    def __init__(self, max_packets: int = 5000) -> None:
        super().__init__(
            html_path=VIEWER_HTML,
            snapshot_event="snapshot",
            stream_event="packets",
            history_limit=max_packets,
            thread_name="packet-log-viewer",
        )


def start_log_viewer_server() -> PacketLogViewerServer:
    return start_viewer_server(PacketLogViewerServer)
