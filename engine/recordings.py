"""Shared app data path helpers."""

import os
from pathlib import Path


def get_app_data_dir() -> Path:
    """Return the writable app data directory."""
    if os.name == "nt":
        appdata_dir = os.environ.get("APPDATA")
        if appdata_dir:
            return Path(appdata_dir) / "aetura"
        return Path.home() / "AppData" / "Roaming" / "aetura"
    else:
        return Path.home() / ".aetura"


def get_recordings_dir() -> Path:
    """Return the writable recordings directory."""
    return get_app_data_dir() / "recordings"


def get_logs_dir() -> Path:
    """Return the writable logs directory."""
    return get_app_data_dir() / "logs"