from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VIEWER_DIR = ROOT / "viewer"
DEFAULT_USERSCRIPT_PATH = ROOT / "userscript.js"
DEFAULT_BROWSER_PROFILE_DIR = (ROOT / ".selenium-profile").resolve()
