from __future__ import annotations

from pathlib import Path


def load_script(script_path: Path) -> str:
    return script_path.read_text(encoding="utf-8")


def inject_userscript(driver, script: str, browser: str) -> None:
    browser = browser.lower()

    if browser in {"chromium", "chrome", "edge"}:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": script},
        )
        return

    raise ValueError(f"Unsupported browser for injection: {browser}")


def inject_userscript_into_page(driver, script: str) -> None:
    driver.execute_script(script)


def userscript_loaded(driver) -> bool:
    return bool(
        driver.execute_script(
            "return Boolean(window.__mopEngineUserscriptLoaded);"
        )
    )
