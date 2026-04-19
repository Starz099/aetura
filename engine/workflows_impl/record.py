"""Record workflow implementation."""

import asyncio
import base64
import os
import shutil
import subprocess
from typing import Dict, List, Optional

from .base import Workflow
from .mocks import MockToolCall
from .settings import _sanitize_recording_settings


class RecordWorkflow(Workflow):
    """Workflow for recording demo videos of automation scripts."""

    async def execute(
        self,
        url: str,
        approved_steps: List[Dict[str, object]],
        recording_settings: Optional[Dict[str, object]] = None,
    ) -> str:
        """Record a video of automation steps."""
        # Note: This workflow doesn't need AI, so we don't initialize it
        os.makedirs("recordings", exist_ok=True)
        config = _sanitize_recording_settings(recording_settings)
        frames_dir = os.path.abspath("temp_frames")
        audio_path = os.path.abspath("temp_audio.wav")
        audio_process: Optional[subprocess.Popen] = None

        if os.path.exists(frames_dir):
            shutil.rmtree(frames_dir)
        os.makedirs(frames_dir)

        if os.path.exists(audio_path):
            os.remove(audio_path)

        video_path = os.path.abspath(
            f"recordings/demo_{int(asyncio.get_event_loop().time())}.mp4",
        )

        # Use direct Playwright async context instead of BrowserEngine
        # to access CDP session for frame capture
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=["--disable-gpu", "--disable-dev-shm-usage"],
            )

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

            if config["record_audio"]:
                audio_cmd = [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "pulse",
                    "-i",
                    config["audio_device"],
                    "-ac",
                    "2",
                    "-ar",
                    "48000",
                    audio_path,
                ]
                try:
                    audio_process = subprocess.Popen(
                        audio_cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    print(f"Audio recording enabled (device: {config['audio_device']})")
                except Exception as error:
                    print(
                        "Audio recording disabled: "
                        f"could not start ffmpeg audio capture ({error})"
                    )
                    audio_process = None

            # Replay steps with cursor visualization
            step_count = 0
            for step_data in approved_steps:
                step_count += 1
                print(f"Recording Step {step_count}...")

                await self._get_dom_state()  # For DOM state tracking

                action_name = step_data["action_taken"]["tool_name"]
                action_args = step_data["action_taken"]["arguments"]

                # Show cursor movement for UI interactions
                if action_name in ["click_element", "hover_element"] and "element_id" in action_args:
                    el_id = action_args["element_id"]
                    box = await self.page.evaluate(
                        f"""
                        () => {{
                            const el = document.querySelector('[data-aetura-id="{el_id}"]');
                            if (!el) return null;
                            const rect = el.getBoundingClientRect();
                            return {{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }};
                        }}
                        """
                    )

                    if box:
                        await self.page.evaluate(
                            f"""
                            () => {{
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
                                cursor.style.left = '{box["x"]}px';
                                cursor.style.top = '{box["y"]}px';
                            }}
                            """
                        )
                        await asyncio.sleep(0.6)

                # Execute action
                mock_call = MockToolCall(action_name, action_args)
                await self._execute_tool_call(mock_call)

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
        ffmpeg_cmd = [
            "ffmpeg",
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

        ffmpeg_cmd.append(video_path)
        subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Cleanup
        shutil.rmtree(frames_dir)
        if os.path.exists(audio_path):
            os.remove(audio_path)
        print(f"Video saved: {video_path}")

        return video_path
