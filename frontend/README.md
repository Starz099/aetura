# Aetura Frontend

## Demo Recording Quality Settings

Recording quality is configurable from Settings and applied when recording from Home.

Request payload key: `recording_settings`

Supported variables:

- `capture_fps`: `15 | 30 | 60` (default `30`)
- `viewport_width`: `640..3840` (default `1920`)
- `viewport_height`: `360..2160` (default `1080`)
- `output_preset`: `ultrafast | superfast | veryfast | faster | fast | medium | slow | slower | veryslow` (default `medium`)

Notes:

- Slower presets improve compression but increase encoding time.
- Missing values are backfilled by engine defaults.
- Backend hardcoded defaults: `capture_frame_quality=100`, `capture_every_nth_frame=1`, `device_scale_factor=3`, `output_crf=12`, `output_profile=main`, `output_pix_fmt=yuv420p`.

### Quick Profiles

- Fast preview: `capture_fps=15`, `output_preset=veryfast`
- Balanced: `capture_fps=30`, `output_preset=medium`
- High fidelity: `capture_fps=60`, `output_preset=slow`
