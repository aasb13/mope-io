from __future__ import annotations

import argparse
import json
import threading
from pathlib import Path

from controller.browser_log_pump import start_browser_log_pump
from controller.browser import BrowserConfig, create_driver
from controller.debug_console import start_debug_log_pump, start_debug_log_viewer_server
from controller.inject import inject_userscript, inject_userscript_into_page, load_script, userscript_loaded
from controller.log_viewer import open_log_viewer, start_log_viewer_server
from controller.paths import DEFAULT_BROWSER_PROFILE_DIR, DEFAULT_USERSCRIPT_PATH
from scripts.build_userscript import build_userscript


DEFAULT_URL = "https://mope.io/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch SeleniumBase UC mode and inject the built mope.io userscript.")
    parser.add_argument("--browser", default="chromium", choices=["chromium", "chrome", "edge"])
    parser.add_argument("--browser-binary", default=None)
    parser.add_argument(
        "--driver-path",
        default=None,
        help="Deprecated with SeleniumBase UC mode; leave unset.",
    )
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--headless", action="store_true")
    parser.add_argument(
        "--browser-profile-dir",
        default=str(DEFAULT_BROWSER_PROFILE_DIR),
        help="Persistent Chromium user-data directory used to keep cookies and browser settings.",
    )
    parser.add_argument(
        "--no-browser-profile",
        action="store_true",
        help="Launch with a temporary browser profile instead of the persistent profile directory.",
    )
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--script", default=None, help="Path to a prebuilt userscript.js")
    parser.add_argument(
        "--packet-log-file",
        default="packet_logs.jsonl",
        help="Write serialized packet logs to this JSONL file while the browser is open.",
    )
    parser.add_argument(
        "--no-packet-log-file",
        action="store_true",
        help="Disable writing packet logs to a file.",
    )
    parser.add_argument(
        "--packet-log-stdout",
        action="store_true",
        help="Pretty-print packet logs live to stdout.",
    )
    parser.add_argument(
        "--packet-log-viewer",
        action="store_true",
        help="Start a local packet viewer UI fed live over Socket.IO.",
    )
    parser.add_argument(
        "--no-open-packet-log-viewer",
        action="store_true",
        help="Start the packet viewer server without opening a browser tab automatically.",
    )
    parser.add_argument(
        "--no-debug-log-viewer",
        action="store_true",
        help="Disable the local debug viewer UI fed live over Socket.IO.",
    )
    parser.add_argument(
        "--no-open-debug-log-viewer",
        action="store_true",
        help="Start the debug viewer server without opening a browser tab automatically.",
    )
    return parser.parse_args()


def start_packet_log_pump(
    driver,
    log_path: Path | None,
    stdout_enabled: bool,
    batch_callback=None,
) -> tuple[threading.Event, list[threading.Thread]]:
    def write_outputs(batch: list[str]) -> None:
        handle = None
        try:
            if log_path is not None:
                log_path.parent.mkdir(parents=True, exist_ok=True)
                handle = log_path.open("a", encoding="utf-8")
                for entry in batch:
                    handle.write(entry)
                    handle.write("\n")
                handle.flush()

            parsed_batch = []
            if stdout_enabled or batch_callback is not None:
                for entry in batch:
                    try:
                        parsed_batch.append(json.loads(entry))
                    except json.JSONDecodeError:
                        if stdout_enabled:
                            print(entry, flush=True)

            if batch_callback is not None and parsed_batch:
                batch_callback(parsed_batch)

            if stdout_enabled:
                for record in parsed_batch:
                    header = record.get("header")
                    label = record.get("label")
                    direction = record.get("direction")
                    length = record.get("length")
                    timestamp = record.get("timestamp")
                    print(f"[{timestamp}] {direction} ID:{header} ({label}) L:{length}", flush=True)

                    parsing_error = record.get("parsingError")
                    if parsing_error:
                        print(f"  parsingError: {parsing_error}", flush=True)

                    parsed = record.get("parsed")
                    if parsed is not None:
                        print(json.dumps(parsed, indent=2, ensure_ascii=True), flush=True)

                    hexdump = record.get("hexdump")
                    if hexdump:
                        print(hexdump, flush=True)
                    print("", flush=True)
        finally:
            if handle is not None:
                handle.close()

    if log_path is None and not stdout_enabled and batch_callback is None:
        emit_batch = None
    else:
        emit_batch = write_outputs

    return start_browser_log_pump(
        driver,
        collect_script="""
        const logs = Array.isArray(window.__mopEnginePacketLogs)
            ? window.__mopEnginePacketLogs.splice(0, window.__mopEnginePacketLogs.length)
            : [];
        return logs;
        """,
        normalize_entries=lambda entries: [
            entry if isinstance(entry, str) else json.dumps(entry, ensure_ascii=True)
            for entry in entries
        ]
        if isinstance(entries, list)
        else [],
        emit_batch=emit_batch,
        collect_thread_name="packet-log-collect",
        emit_thread_name="packet-log-output",
    )


def main() -> int:
    args = parse_args()

    if args.script:
        script_path = Path(args.script).resolve()
    elif args.skip_build:
        script_path = DEFAULT_USERSCRIPT_PATH
    else:
        script_path = build_userscript()

    script = load_script(script_path)
    driver = create_driver(
        BrowserConfig(
            browser=args.browser,
            browser_binary=args.browser_binary,
            driver_path=args.driver_path,
            headless=args.headless,
            user_data_dir=None if args.no_browser_profile else Path(args.browser_profile_dir).resolve(),
        )
    )
    log_path = None if args.no_packet_log_file else Path(args.packet_log_file).resolve()
    stop_event = None
    pump_threads: list[threading.Thread] = []
    debug_stop_event = None
    debug_pump_threads: list[threading.Thread] = []
    viewer_server = None
    viewer_url = None
    debug_viewer_server = None
    debug_viewer_url = None

    try:
        inject_userscript(driver, script, args.browser)
        driver.default_get(args.url)
        if not userscript_loaded(driver):
            inject_userscript_into_page(driver, script)
        if not userscript_loaded(driver):
            for entry in driver.get_log('browser'):
                print(entry['message'])
            raise RuntimeError(
                "Userscript injection failed: __mopEngineUserscriptLoaded was not set on the page "
                "after CDP registration and live-page injection."
            )

        if not args.no_debug_log_viewer:
            debug_viewer_server = start_debug_log_viewer_server()
            debug_viewer_url = debug_viewer_server.url
            if not args.no_open_debug_log_viewer:
                open_log_viewer(debug_viewer_url)

            debug_stop_event, debug_pump_threads = start_debug_log_pump(
                driver,
                batch_callback=debug_viewer_server.emit_entries,
            )

        if args.packet_log_viewer:
            viewer_server = start_log_viewer_server()
            viewer_url = viewer_server.url
            if not args.no_open_packet_log_viewer:
                open_log_viewer(viewer_url)

        stop_event, pump_threads = start_packet_log_pump(
            driver,
            log_path,
            args.packet_log_stdout,
            batch_callback=viewer_server.emit_entries if viewer_server is not None else None,
        )
        print(f"Injected {script_path} into {args.browser} and opened {args.url}")
        if args.no_browser_profile:
            print("Using a temporary browser profile")
        else:
            print(f"Using persistent browser profile at {Path(args.browser_profile_dir).resolve()}")
        if log_path is not None:
            print(f"Writing packet logs to {log_path}")
        if args.packet_log_stdout:
            print("Streaming packet logs to stdout")
        if viewer_url is not None:
            print(f"Packet viewer available at {viewer_url}")
        if debug_viewer_url is not None:
            print(f"Debug viewer available at {debug_viewer_url}")
        input("Press Enter to close the browser...")
    finally:
        if stop_event is not None:
            stop_event.set()
        if debug_stop_event is not None:
            debug_stop_event.set()
        for thread in pump_threads:
            thread.join(timeout=1.0)
        for thread in debug_pump_threads:
            thread.join(timeout=1.0)
        if viewer_server is not None:
            viewer_server.shutdown()
        if debug_viewer_server is not None:
            debug_viewer_server.shutdown()
        driver.quit()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
