"""Record workflow implementation."""

import asyncio
import base64
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from models.script import BoundingBox, EnrichedStep
from .base import Workflow
from .mocks import MockToolCall
from .settings import _sanitize_recording_settings
from recordings import get_recordings_dir


class RecordWorkflow(Workflow):
    """Workflow for recording demo videos of automation scripts."""

    async def execute(
        self,
        url: str,
        approved_steps: List[Dict[str, object]],
        recording_settings: Optional[Dict[str, object]] = None,
    ) -> tuple[str, List[Dict[str, object]]]:
        """Record a video of automation steps and return (video_path, enriched_steps)."""
        # Note: This workflow doesn't need AI, so we don't initialize it
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        config = _sanitize_recording_settings(recording_settings)
        frames_dir = os.path.abspath("temp_frames")
        audio_path = os.path.abspath("temp_audio.wav")
        audio_process: Optional[subprocess.Popen] = None

        if os.path.exists(frames_dir):
            shutil.rmtree(frames_dir)
        os.makedirs(frames_dir)

        if os.path.exists(audio_path):
            os.remove(audio_path)

        video_path = recordings_dir / f"demo_{int(asyncio.get_event_loop().time())}.mp4"

        # Use bundled ffmpeg binary path when provided by the Tauri host via
        # the FFMPEG_PATH environment variable. Fall back to system `ffmpeg`
        # to support local development.
        ffmpeg_exe = os.environ.get("FFMPEG_PATH", "ffmpeg")

        from playwright.async_api import async_playwright, Error as PlaywrightError

        enriched_steps = []

        async with async_playwright() as p:
            try:
                browser = await p.chromium.launch(
                    headless=False,
                    args=["--disable-gpu", "--disable-dev-shm-usage"],
                )
            except PlaywrightError as e:
                if "Executable doesn't exist" in str(e) or "not found" in str(e).lower():
                    print("Chromium not found during recording. Attempting to install...")
                    import sys
                    try:
                        subprocess.run(
                            [sys.executable, "__playwright_cli__", "install", "chromium"],
                            check=True,
                            capture_output=True,
                            text=True
                        )
                        print("Chromium installed successfully. Retrying recording launch...")
                        browser = await p.chromium.launch(
                            headless=False,
                            args=["--disable-gpu", "--disable-dev-shm-usage"],
                        )
                    except Exception as install_error:
                        raise RuntimeError(
                            f"Failed to auto-install Chromium for recording: {install_error}"
                        ) from install_error
                else:
                    raise e

            context = await browser.new_context(
                viewport={
                    "width": config["viewport_width"],
                    "height": config["viewport_height"],
                },
                device_scale_factor=config["device_scale_factor"],
            )
            self.page = await context.new_page()

            client = await context.new_cdp_session(self.page)
            frame_counter = {"count": 0}

            async def handle_frame(event):
                frame_counter["count"] += 1
                data = event.get("data")
                session_id = event.get("sessionId")

                with open(
                    os.path.join(frames_dir, f"frame_{frame_counter['count']:05d}.jpg"),
                    "wb",
                ) as file_handle:
                    file_handle.write(base64.b64decode(data))

                await client.send("Page.screencastFrameAck", {"sessionId": session_id})

            client.on("Page.screencastFrame", handle_frame)

            # Navigate and start capture
            print(f"Recording: Navigating to {url}")
            await self.page.goto(url)
            await self.page.wait_for_load_state("networkidle")

            print("Starting frame capture...")
            await client.send(
                "Page.startScreencast",
                {
                    "format": "jpeg",
                    "quality": config["capture_frame_quality"],
                    "everyNthFrame": config["capture_every_nth_frame"],
                },
            )

            recording_start_time = asyncio.get_event_loop().time()

            if config["record_audio"]:
                # Audio recording is OS-specific and complex; disable on Windows for now
                if platform.system() == "Windows":
                    print("Audio recording skipped on Windows (not yet supported)")
                else:
                    # Linux/Mac: use pulse for audio on Linux, coreaudio on Mac
                    audio_format = "pulse" if platform.system() == "Linux" else "dshow"
                    audio_cmd = [
                        ffmpeg_exe,
                        "-y",
                        "-f",
                        audio_format,
                        "-i",
                        config.get("audio_device", "default"),
                        "-ac",
                        "2",
                        "-ar",
                        "48000",
                        audio_path,
                    ]
                    try:
                        print(f"Starting audio capture ({audio_format})...")
                        audio_process = subprocess.Popen(
                            audio_cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            text=True,
                        )
                        print(f"Audio recording started (device: {config.get('audio_device', 'default')})")
                    except FileNotFoundError:
                        print("Audio recording disabled: ffmpeg not found in PATH")
                        audio_process = None
                    except Exception as error:
                        print(f"Audio recording disabled: {error}")
                        audio_process = None

            # Replay steps with cursor visualization
            step_count = 0
            for step_data in approved_steps:
                step_count += 1
                current_timestamp = asyncio.get_event_loop().time() - recording_start_time
                print(f"Recording Step {step_count} at {current_timestamp:.2f}s...")

                await self._get_dom_state()  # For DOM state tracking

                action_name = step_data["action_taken"]["tool_name"]
                action_args = step_data["action_taken"]["arguments"]

                # Capture element position if applicable
                element_rect = None
                if "element_id" in action_args:
                    el_id = action_args["element_id"]
                    element_rect = await self.page.evaluate(
                        f"""
                        () => {{
                            const el = document.querySelector('[data-aetura-id="{el_id}"]');
                            if (!el) return null;
                            const rect = el.getBoundingClientRect();
                            return {{ 
                                x: rect.left, 
                                y: rect.top, 
                                width: rect.width, 
                                height: rect.height 
                            }};
                        }}
                        """
                    )

                # Show cursor movement for UI interactions
                if action_name in ["click_element", "hover_element"] and element_rect:
                    await self.page.evaluate(
                        f"""
                        (box) => {{
                            let cursor = document.getElementById('aetura-cursor');
                            if (!cursor) {{
                                cursor = document.createElement('div');
                                cursor.id = 'aetura-cursor';
                                cursor.style.width = '24px';
                                cursor.style.height = '24px';
                                cursor.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                                cursor.style.border = '2px solid white';
                                cursor.style.borderRadius = '50%';
                                cursor.style.position = 'fixed';
                                cursor.style.pointerEvents = 'none';
                                cursor.style.zIndex = '999999';
                                cursor.style.transition = 'top 0.5s ease-out, left 0.5s ease-out';
                                cursor.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                                document.body.appendChild(cursor);
                            }}
                            cursor.style.left = (box.x + box.width / 2) + 'px';
                            cursor.style.top = (box.y + box.height / 2) + 'px';
                        }}
                        """,
                        element_rect
                    )
                    await asyncio.sleep(0.6)

                # Execute action
                mock_call = MockToolCall(action_name, action_args)
                await self._execute_tool_call(mock_call)
                
                # Build enriched step data
                enriched_step = EnrichedStep(
                    **step_data,
                    timestamp=current_timestamp,
                    element_rect=element_rect
                )
                enriched_steps.append(enriched_step.model_dump())

                await self.page.wait_for_load_state("load")
                await asyncio.sleep(1)

            # Stop capture and close browser
            print("Stopping capture...")
            await client.send("Page.stopScreencast")
            await context.close()
            await browser.close()

        if audio_process is not None:
            audio_process.terminate()
            try:
                audio_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                audio_process.kill()
                audio_process.wait(timeout=5)

        # Stitch frames into video
        print("Encoding video...")
        
        # Validate frames were captured
        captured_frames = list(Path(frames_dir).glob("frame_*.jpg"))
        if not captured_frames:
            raise RuntimeError(f"No frames captured in {frames_dir}")
        print(f"Found {len(captured_frames)} captured frames")
        
        ffmpeg_cmd = [
            ffmpeg_exe,
            "-y",
            "-framerate",
            str(config["capture_fps"]),
            "-i",
            os.path.join(frames_dir, "frame_%05d.jpg"),
            "-c:v",
            "libx264",
            "-profile:v",
            config["output_profile"],
            "-movflags",
            "+faststart",
            "-preset",
            config["output_preset"],
            "-pix_fmt",
            config["output_pix_fmt"],
            "-crf",
            str(config["output_crf"]),
        ]

        has_audio = (
            config["record_audio"]
            and not platform.system() == "Windows"
            and os.path.exists(audio_path)
            and os.path.getsize(audio_path) > 0
        )

        if has_audio:
            ffmpeg_cmd.extend(
                [
                    "-i",
                    audio_path,
                    "-c:a",
                    "aac",
                    "-b:a",
                    f"{config['audio_bitrate_kbps']}k",
                    "-shortest",
                ]
            )

        ffmpeg_cmd.append(str(video_path))
        
        # Run ffmpeg with visible output for debugging
        try:
            result = subprocess.run(ffmpeg_cmd, check=False, capture_output=False, text=False)
            if result.returncode != 0:
                print(f"WARNING: ffmpeg exited with code {result.returncode}")
            elif not video_path.exists():
                raise RuntimeError(f"ffmpeg completed but output file not created: {video_path}")
            else:
                print(f"Video saved: {video_path}")
        except FileNotFoundError:
            raise RuntimeError("ffmpeg not found in PATH. Please install ffmpeg to record videos.")

        # Cleanup
        shutil.rmtree(frames_dir)
        if os.path.exists(audio_path):
            os.remove(audio_path)

        return str(video_path), enriched_steps
