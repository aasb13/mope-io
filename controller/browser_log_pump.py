from __future__ import annotations

import threading
import time
from typing import Callable, TypeVar


T = TypeVar("T")

CollectScript = str
NormalizeFn = Callable[[object], list[T]]
BatchFn = Callable[[list[T]], None]


def start_browser_log_pump(
    driver,
    *,
    collect_script: CollectScript,
    normalize_entries: NormalizeFn[T],
    emit_batch: BatchFn[T] | None = None,
    poll_interval: float = 0.25,
    collect_thread_name: str,
    emit_thread_name: str,
) -> tuple[threading.Event, list[threading.Thread]]:
    stop_event = threading.Event()
    pending_entries: list[T] = []
    pending_lock = threading.Lock()
    threads: list[threading.Thread] = []

    def collect() -> None:
        while not stop_event.is_set():
            try:
                raw_entries = driver.execute_script(collect_script)
            except Exception:
                time.sleep(poll_interval)
                continue

            normalized = normalize_entries(raw_entries)
            if normalized:
                with pending_lock:
                    pending_entries.extend(normalized)

            time.sleep(poll_interval)

    def emit() -> None:
        while not stop_event.is_set():
            with pending_lock:
                batch = pending_entries[:]
                pending_entries.clear()

            if not batch:
                time.sleep(poll_interval)
                continue

            if emit_batch is not None:
                emit_batch(batch)

        with pending_lock:
            batch = pending_entries[:]
            pending_entries.clear()

        if batch and emit_batch is not None:
            emit_batch(batch)

    collect_thread = threading.Thread(target=collect, name=collect_thread_name, daemon=True)
    collect_thread.start()
    threads.append(collect_thread)

    if emit_batch is not None:
        output_thread = threading.Thread(target=emit, name=emit_thread_name, daemon=True)
        output_thread.start()
        threads.append(output_thread)

    return stop_event, threads
