#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEOBF_PATH = REPO_ROOT / "assets" / "deobf.js"
DOWNLOAD_ROOT = SCRIPT_DIR / "downloads"
MANIFEST_PATH = SCRIPT_DIR / "candidate_manifest.json"
DEFAULT_PROXY_JSON = Path("/home/dr/proxy-scraper-checker/out/proxies.json")
DEFAULT_BASE_URL = "https://mope.io/assets/s/1/"
DEFAULT_TIMEOUT = 20
DEFAULT_WORKERS = 8
DEFAULT_RETRIES = 4
REQUEST_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
REQUEST_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"

ASSET_LITERAL_PATTERN = re.compile(
    r"""(?P<quote>["'])"""
    r"""(?P<path>(?:\.?/)?(?:skins|img|gameobj|shop)/[^"'\\]*(?:\.(?:png|jpg|jpeg|webp|gif)|))"""
    r"""(?P=quote)"""
)
SKIN_NAME_PATTERN = re.compile(r'''skinName\s*=\s*"([^"]+)"''')
OBJ_SKIN_PATH_PATTERN = re.compile(r'''objSkinPath\s*=\s*"([^"]+)"''')

COMMON_IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif")
BIOME_FOLDER_BY_ID = {
    0: "land",
    1: "ocean",
    2: "arctic",
    3: "volcano",
    4: "desert",
}


@dataclass(frozen=True)
class DownloadResult:
    path: str
    status: str
    url: str
    detail: str | None = None
    bytes_written: int = 0


def normalize_asset_path(path: str) -> str | None:
    value = path.strip()
    if not value:
        return None

    if value.startswith("./"):
        value = value[2:]
    elif value.startswith("/"):
        value = value[1:]

    value = value.replace("//", "/")
    while "//" in value:
        value = value.replace("//", "/")

    if not any(value.startswith(prefix) for prefix in ("skins/", "img/", "gameobj/", "shop/")):
        return None

    if value.endswith("/"):
        return None

    tail = value.rsplit("/", 1)[-1]
    if not tail:
        return None

    return value


def has_known_extension(path: str) -> bool:
    lower = path.lower()
    return lower.endswith(COMMON_IMAGE_SUFFIXES)


def build_skin_candidates(name: str) -> set[str]:
    normalized = name.strip().strip("/")
    if not normalized:
        return set()

    candidates: set[str] = set()
    base = f"skins/{normalized}"
    candidates.add(f"{base}.png")

    return {candidate for candidate in candidates if normalize_asset_path(candidate)}


def extract_function_body(source: str, anchor: str) -> str | None:
    anchor_index = source.find(anchor)
    if anchor_index == -1:
        return None

    open_brace_index = source.find("{", anchor_index)
    if open_brace_index == -1:
        return None

    depth = 0
    for index in range(open_brace_index, len(source)):
        char = source[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[open_brace_index + 1:index]

    return None


def parse_shop_animal_names(deobf_text: str) -> dict[int, str]:
    body = extract_function_body(deobf_text, "getAnimalName = function ()")
    if not body:
        return {}

    result: dict[int, str] = {}
    for animal_type, folder_name in re.findall(r'''case\s+(0x[0-9a-fA-F]+|\d+)\s*:\s*return\s+"([^"]+)";''', body):
        result[int(animal_type, 0)] = folder_name
    return result


def parse_shop_biomes(deobf_text: str) -> dict[int, int]:
    body = extract_function_body(deobf_text, "setBiome = function")
    if not body:
        return {}

    result: dict[int, int] = {}
    switch_match = re.search(r'''switch\s*\([^)]*\)\s*\{(?P<body>.*)\}''', body, re.DOTALL)
    if not switch_match:
        return result

    switch_body = switch_match.group("body")
    case_blocks = re.findall(
        r'''((?:case\s+(?:0x[0-9a-fA-F]+|\d+)\s*:\s*)+)this\.biome\s*=\s*(0x[0-9a-fA-F]+|\d+);''',
        switch_body,
        re.DOTALL,
    )
    for case_block, biome_id in case_blocks:
        biome_value = int(biome_id, 0)
        animal_types = re.findall(r'''case\s+(0x[0-9a-fA-F]+|\d+)\s*:''', case_block)
        for animal_type in animal_types:
            result[int(animal_type, 0)] = biome_value
    return result


def build_biome_skin_candidates(deobf_text: str) -> set[str]:
    names_by_type = parse_shop_animal_names(deobf_text)
    biome_by_type = parse_shop_biomes(deobf_text)
    candidates: set[str] = set()

    for animal_type, folder_name in names_by_type.items():
        biome_folder = BIOME_FOLDER_BY_ID.get(biome_by_type.get(animal_type, 0))
        if not biome_folder:
            continue

        normalized_folder = folder_name.strip().strip("/")
        if not normalized_folder:
            continue

        candidates.add(f"skins/{biome_folder}/{normalized_folder}/0/{normalized_folder}.png")
        candidates.add(f"skins/{biome_folder}/{normalized_folder}/{normalized_folder}.png")

    return {candidate for candidate in candidates if normalize_asset_path(candidate)}


def discover_candidates(deobf_text: str) -> list[str]:
    candidates: set[str] = set()

    for match in ASSET_LITERAL_PATTERN.finditer(deobf_text):
        raw_path = match.group("path")
        normalized = normalize_asset_path(raw_path)
        if not normalized:
            continue

        if has_known_extension(normalized):
            candidates.add(normalized)
        else:
            for suffix in COMMON_IMAGE_SUFFIXES:
                candidates.add(f"{normalized}{suffix}")

    for pattern in (SKIN_NAME_PATTERN, OBJ_SKIN_PATH_PATTERN):
        for match in pattern.finditer(deobf_text):
            candidates.update(build_skin_candidates(match.group(1)))

    candidates.update(build_biome_skin_candidates(deobf_text))
    candidates.add("img/healingStone.png")
    candidates.add("skins/ocean/shrimp/0/shrimp.png")

    return sorted(candidates)


def load_proxy_pool(path: Path) -> list[str]:
    items = json.loads(path.read_text(encoding="utf-8"))
    proxies: list[str] = []
    for item in items:
        protocol = str(item.get("protocol") or "").strip().lower()
        host = str(item.get("host") or "").strip()
        port = item.get("port")
        if protocol not in {"http", "socks4", "socks5"} or not host or not isinstance(port, int):
            continue

        username = item.get("username")
        password = item.get("password")
        auth = ""
        if isinstance(username, str) and username:
            password_text = password if isinstance(password, str) else ""
            auth = f"{urllib.parse.quote(username)}:{urllib.parse.quote(password_text)}@"

        proxies.append(f"{protocol}://{auth}{host}:{port}")

    unique = sorted(set(proxies))
    if not unique:
        raise ValueError(f"No usable proxies found in {path}")
    return unique


def looks_like_image(data: bytes) -> bool:
    return (
        data.startswith(b"\x89PNG\r\n\x1a\n")
        or data.startswith(b"\xff\xd8\xff")
        or data.startswith(b"GIF87a")
        or data.startswith(b"GIF89a")
        or (len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )


def download_one(
    base_url: str,
    relative_path: str,
    timeout: int,
    skip_existing: bool,
    retries: int,
    proxy_pool: list[str],
) -> DownloadResult:
    output_path = DOWNLOAD_ROOT / relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    url = urllib.parse.urljoin(base_url, relative_path)

    if skip_existing and output_path.exists() and output_path.stat().st_size > 0:
        return DownloadResult(path=relative_path, status="skipped", url=url, bytes_written=output_path.stat().st_size)

    attempts = max(1, retries + 1)
    for attempt in range(1, attempts + 1):
        proxy_url = random.choice(proxy_pool)
        temp_path = output_path.with_name(f"{output_path.name}.part")
        curl_command = [
            "curl",
            "--insecure",
            "--location",
            "--silent",
            "--show-error",
            "--fail",
            "--max-time",
            str(timeout),
            "--connect-timeout",
            str(min(timeout, 10)),
            "--user-agent",
            REQUEST_USER_AGENT,
            "--referer",
            "https://mope.io/",
            "-H",
            f"Accept: {REQUEST_ACCEPT}",
            "-H",
            "Accept-Language: en-US,en;q=0.9",
            "-H",
            "Cache-Control: no-cache",
            "-H",
            "Pragma: no-cache",
            "--proxy",
            proxy_url,
            "--output",
            str(temp_path),
            url,
        ]
        try:
            completed = subprocess.run(
                curl_command,
                capture_output=True,
                text=True,
                check=False,
            )
            if completed.returncode != 0:
                if temp_path.exists():
                    temp_path.unlink()
                if attempt < attempts:
                    continue
                detail = (completed.stderr or completed.stdout or f"curl exit {completed.returncode}").strip()
                return DownloadResult(path=relative_path, status="failed", url=url, detail=detail[:200])

            data = temp_path.read_bytes()
            if not data:
                temp_path.unlink(missing_ok=True)
                if attempt < attempts:
                    continue
                return DownloadResult(path=relative_path, status="failed", url=url, detail="empty response body")

            if not looks_like_image(data):
                temp_path.unlink(missing_ok=True)
                if attempt < attempts:
                    continue
                return DownloadResult(path=relative_path, status="failed", url=url, detail="non-image response")

            temp_path.replace(output_path)
            return DownloadResult(path=relative_path, status="downloaded", url=url, bytes_written=len(data))
        except Exception as error:  # noqa: BLE001
            temp_path.unlink(missing_ok=True)
            if attempt < attempts:
                continue
            return DownloadResult(path=relative_path, status="failed", url=url, detail=type(error).__name__)

    return DownloadResult(path=relative_path, status="failed", url=url, detail="exhausted retries")


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dump mope.io image assets into assets/gameAssets/downloads.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"Asset base URL. Default: {DEFAULT_BASE_URL}")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help=f"Per-request timeout in seconds. Default: {DEFAULT_TIMEOUT}")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help=f"Concurrent download workers. Default: {DEFAULT_WORKERS}")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help=f"Retry count for transient failures such as HTTP 429. Default: {DEFAULT_RETRIES}")
    parser.add_argument("--limit", type=int, default=0, help="Only attempt the first N candidates after sorting.")
    parser.add_argument("--proxy-json", type=Path, default=DEFAULT_PROXY_JSON, help=f"Proxy pool JSON path. Default: {DEFAULT_PROXY_JSON}")
    parser.add_argument("--skip-existing", action="store_true", help="Skip files that already exist on disk.")
    args = parser.parse_args()

    deobf_text = DEOBF_PATH.read_text(encoding="utf-8", errors="ignore")
    candidates = discover_candidates(deobf_text)
    if args.limit > 0:
        candidates = candidates[:args.limit]
    proxy_pool = load_proxy_pool(args.proxy_json)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_json(
        MANIFEST_PATH,
        {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "candidateCount": len(candidates),
            "baseUrl": args.base_url,
            "proxyCount": len(proxy_pool),
            "candidates": candidates,
        },
    )

    print(f"Base URL: {args.base_url}")
    print(f"Candidates: {len(candidates)}")
    print(f"Proxies: {len(proxy_pool)}")
    print(f"Output: {DOWNLOAD_ROOT}")

    started = time.time()
    lock = threading.Lock()
    downloaded = 0
    skipped = 0
    failed = 0
    results: list[dict[str, object]] = []

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_map = {
            executor.submit(download_one, args.base_url, candidate, args.timeout, args.skip_existing, args.retries, proxy_pool): candidate
            for candidate in candidates
        }
        for future in as_completed(future_map):
            result = future.result()
            record = {
                "path": result.path,
                "status": result.status,
                "url": result.url,
                "detail": result.detail,
                "bytes": result.bytes_written,
            }
            results.append(record)

            with lock:
                if result.status == "downloaded":
                    downloaded += 1
                    print(f"[downloaded] {result.path} ({result.bytes_written} bytes)", flush=True)
                elif result.status == "skipped":
                    skipped += 1
                    print(f"[skipped]    {result.path}", flush=True)
                else:
                    failed += 1
                    print(f"[failed]     {result.path} ({result.detail})", flush=True)

    elapsed = time.time() - started

    print("")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped:    {skipped}")
    print(f"Failed:     {failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

