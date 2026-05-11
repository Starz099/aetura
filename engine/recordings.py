"""Shared recordings path helpers."""

import os
from pathlib import Path


def get_recordings_dir() -> Path:
    """Return the writable recordings directory under APPDATA."""
    appdata_dir = os.environ.get("APPDATA")
    if appdata_dir:
        base_dir = Path(appdata_dir)
    else:
        base_dir = Path.home() / "AppData" / "Roaming"

    return base_dir / "aetura" / "recordings"