import os
import glob
import json
import argparse
import ctypes
import sys
import threading
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from orchestrator import draft_demo_script, resume_demo_script, record_demo_video, edit_video_manifest
from typing import List, Any, Optional, Literal, Dict
from fastapi.staticfiles import StaticFiles

# Parse CLI arguments
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
parser.add_argument("--parent-pid", type=int, default=0, help="Parent process ID to watch")
args = parser.parse_args()

# Use a writable app data directory for recordings
recordings_dir = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "aetura" / "recordings"
os.makedirs(recordings_dir, exist_ok=True)
app = FastAPI(title="Aetura Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/recordings", StaticFiles(directory=str(recordings_dir)), name="recordings")


def is_process_running(pid: int) -> bool:
    if pid <= 0:
        return False

    if os.name == "nt":
        process_handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not process_handle:
            return False

        try:
            exit_code = ctypes.c_ulong()
            if not ctypes.windll.kernel32.GetExitCodeProcess(process_handle, ctypes.byref(exit_code)):
                return False
            return exit_code.value == 259
        finally:
            ctypes.windll.kernel32.CloseHandle(process_handle)
    else:
        # Unix/Linux fallback
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def start_parent_watchdog(parent_pid: int) -> None:
    if parent_pid <= 0:
        return

    def watch_parent() -> None:
        while True:
            if not is_process_running(parent_pid):
                os._exit(0)
            time.sleep(1)

    threading.Thread(target=watch_parent, daemon=True).start()


class ExploreRequest(BaseModel):
    url: str
    intent: str
    grok_api_key: str


class ResumeRequest(BaseModel):
    url: str
    intent: str
    approved_steps: List[Any]
    grok_api_key: str


class RecordingSettingsRequest(BaseModel):
    capture_fps: Optional[Literal[15, 30, 60]] = None
    viewport_width: Optional[int] = Field(default=None, ge=640, le=3840)
    viewport_height: Optional[int] = Field(default=None, ge=360, le=2160)
    record_audio: Optional[bool] = None
    output_preset: Optional[
        Literal[
            "ultrafast",
            "superfast",
            "veryfast",
            "faster",
            "fast",
            "medium",
            "slow",
            "slower",
            "veryslow",
        ]
    ] = None


def _dump_recording_settings(
    settings: Optional[RecordingSettingsRequest],
) -> Optional[Dict[str, Any]]:
    if settings is None:
        return None

    if hasattr(settings, "model_dump"):
        return settings.model_dump(exclude_none=True)

    return settings.dict(exclude_none=True)


class RecordRequest(BaseModel):
    url: str
    approved_steps: List[Any]
    recording_settings: Optional[RecordingSettingsRequest] = None


class EditRequest(BaseModel):
    steps: List[Any]
    intent: str
    current_manifest: Optional[Dict[str, Any]] = None
    grok_api_key: str
    duration: Optional[float] = None


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Aetura Engine API.",
        "status": "online",
        "docs_url": f"http://{args.host}:{args.port}/docs",
    }


@app.post("/explore")
async def explore_website(request: ExploreRequest):
    print(f"Received API request to explore: {request.url, request.intent}")
    try:
        ai_result = await draft_demo_script(
            request.url,
            request.intent,
            request.grok_api_key,
        )
    except Exception as error:
        error_text = str(error).lower()
        if "rate limit" in error_text or "429" in error_text:
            raise HTTPException(status_code=429, detail=str(error)) from error
        raise HTTPException(status_code=422, detail=str(error)) from error

    with open("dev_cache.json", "w") as f:
        json.dump(ai_result, f)

    return {"status": "success", "agent_message": ai_result}


@app.post("/explore/resume")
async def resume_website(request: ResumeRequest):
    print(f"Resuming script for: {request.url}")
    try:
        script_data = await resume_demo_script(
            request.url,
            request.intent,
            request.approved_steps,
            request.grok_api_key,
        )
    except Exception as error:
        error_text = str(error).lower()
        if "rate limit" in error_text or "429" in error_text:
            raise HTTPException(status_code=429, detail=str(error)) from error
        raise HTTPException(status_code=422, detail=str(error)) from error

    return script_data


@app.post("/record")
async def record_website(request: RecordRequest):
    print(f"Received API request to record: {request.url}")
    try:
        full_video_path, enriched_steps = await record_demo_video(
            request.url,
            request.approved_steps,
            _dump_recording_settings(request.recording_settings),
        )
    except Exception as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    filename = os.path.basename(full_video_path)
    return {
        "status": "success",
        "video_url": f"http://{args.host}:{args.port}/recordings/{filename}",
        "enriched_steps": enriched_steps,
    }


@app.post("/edit")
async def edit_website(request: EditRequest):
    print(f"Received API request to edit video")
    try:
        manifest = await edit_video_manifest(
            request.steps,
            request.intent,
            request.current_manifest,
            request.grok_api_key,
            request.duration,
        )
    except Exception as error:
        error_text = str(error).lower()
        if "rate limit" in error_text or "429" in error_text:
            raise HTTPException(status_code=429, detail=str(error)) from error
        # Return error response with frontend-expected format
        return {
            "status": "error",
            "message": str(error),
        }

    return {
        "status": "success",
        "manifest": manifest,
    }


@app.get("/dev/load-cache")
async def load_dev_cache():
    try:
        with open("dev_cache.json", "r") as f:
            cached_data = json.load(f)
            return cached_data
    except FileNotFoundError:
        return {"error": "No cache found. Run a real mapping first."}


@app.get("/library")
async def get_library_videos():
    """Returns recorded videos with both local path and preview URL."""
    # Get all mp4 files in the folder
    search_path = os.path.abspath(os.path.join(str(recordings_dir), "*.mp4"))
    video_files = glob.glob(search_path)

    # Sort by newest first
    video_files.sort(key=os.path.getmtime, reverse=True)

    videos = []
    for file_path in video_files:
        filename = os.path.basename(file_path)
        videos.append(
            {
                "filename": filename,
                "absolute_path": file_path,
                "video_url": f"http://{args.host}:{args.port}/recordings/{filename}",
                "created_at": os.path.getmtime(file_path),
            }
        )

    return {"videos": videos}


if __name__ == "__main__":
    start_parent_watchdog(args.parent_pid)
    uvicorn.run(app, host=args.host, port=args.port)