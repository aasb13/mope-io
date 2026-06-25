from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from seleniumbase import Driver


@dataclass
class BrowserConfig:
    browser: str = "chromium"
    browser_binary: Optional[str] = None
    driver_path: Optional[str] = None
    headless: bool = False
    user_data_dir: Optional[Path] = None


def create_driver(config: BrowserConfig):
    browser = config.browser.lower()

    if browser not in {"chromium", "chrome", "edge"}:
        raise ValueError(f"Unsupported browser: {config.browser}")

    if config.driver_path:
        raise ValueError(
            "--driver-path is no longer supported with SeleniumBase UC mode. "
            "Use SeleniumBase's managed drivers, put the driver on PATH, or pass "
            "--browser-binary to select a specific browser binary."
        )

    driver_kwargs = {
        "uc": True,
        "headed": not config.headless,
        "headless": config.headless,
    }

    if browser == "chromium":
        driver_kwargs["browser"] = "chrome"
        driver_kwargs["use_chromium"] = True
    else:
        driver_kwargs["browser"] = browser

    if config.browser_binary:
        driver_kwargs["binary_location"] = config.browser_binary

    if config.user_data_dir:
        profile_dir = Path(config.user_data_dir).resolve()
        profile_dir.mkdir(parents=True, exist_ok=True)
        driver_kwargs["user_data_dir"] = str(profile_dir)

    return Driver(**driver_kwargs)
