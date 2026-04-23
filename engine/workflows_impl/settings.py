"""Recording configuration defaults and sanitization helpers."""

from typing import Any, Dict, Optional

DEFAULT_RECORDING_SETTINGS = {
    "capture_fps": 30,
    # Hardcoded backend-only values (not user-configurable)
    "capture_frame_quality": 100,
    "capture_every_nth_frame": 1,
    "device_scale_factor": 3,
    "output_crf": 12,
    "output_profile": "main",
    "output_pix_fmt": "yuv420p",
    # User-configurable values
    "viewport_width": 1920,
    "viewport_height": 1080,
    "record_audio": False,
    "audio_device": "default",
    "audio_bitrate_kbps": 192,
    "output_preset": "medium",
}

ALLOWED_CAPTURE_FPS = {15, 30, 60}
ALLOWED_OUTPUT_PRESETS = {
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
}


def _clamp_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(maximum, parsed))


def _sanitize_recording_settings(
    recording_settings: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if not isinstance(recording_settings, dict):
        return dict(DEFAULT_RECORDING_SETTINGS)

    settings = dict(DEFAULT_RECORDING_SETTINGS)

    # Only accept explicit supported FPS values; unsupported values fall back to default.
    capture_fps = recording_settings.get("capture_fps")
    try:
        parsed_capture_fps = int(capture_fps)
    except (TypeError, ValueError):
        parsed_capture_fps = settings["capture_fps"]
    settings["capture_fps"] = (
        parsed_capture_fps
        if parsed_capture_fps in ALLOWED_CAPTURE_FPS
        else settings["capture_fps"]
    )

    settings["viewport_width"] = _clamp_int(
        recording_settings.get("viewport_width"),
        settings["viewport_width"],
        640,
        3840,
    )
    settings["viewport_height"] = _clamp_int(
        recording_settings.get("viewport_height"),
        settings["viewport_height"],
        360,
        2160,
    )

    settings["record_audio"] = bool(recording_settings.get("record_audio", False))

    output_preset = recording_settings.get("output_preset")
    if output_preset in ALLOWED_OUTPUT_PRESETS:
        settings["output_preset"] = output_preset

    return settings
