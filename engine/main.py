import os
import json
import argparse
import ctypes
import sys
import threading
import time
import logging
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from orchestrator import draft_demo_script, resume_demo_script, record_demo_video, edit_video_manifest
from typing import List, Any, Optional, Literal, Dict
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from recordings import get_recordings_dir, get_logs_dir

# Global state for CLI arguments
class AppState:
    host = "127.0.0.1"
    port = 8000
    recordings_dir = None

state = AppState()

# Persistent location for Playwright browsers
playwright_browsers_path = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))) / "aetura" / "playwright"
os.makedirs(playwright_browsers_path, exist_ok=True)
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(playwright_browsers_path)

# Capture original streams for logging
original_stdout = sys.stdout
original_stderr = sys.stderr

# Redirect stdout/stderr to logger for packaged app debugging
class LoggerWriter:
    _lock = threading.local()

    def __init__(self, writer_func):
        self.writer_func = writer_func
        self.encoding = "utf-8"
        self.errors = "replace"

    def write(self, message):
        if not getattr(self._lock, "in_logging", False):
            try:
                self._lock.in_logging = True
                if message.strip():
                    self.writer_func(message.strip())
            finally:
                self._lock.in_logging = False
        else:
            # Fallback to original stream if we are already in a logging call
            if self.writer_func == logger.error:
                original_stderr.write(message)
            else:
                original_stdout.write(message)

    def flush(self):
        pass

    def isatty(self):
        return False

def setup_logging():
    global logger
    logs_dir = get_logs_dir()
    os.makedirs(logs_dir, exist_ok=True)
    log_file = logs_dir / "engine.log"

    # Define the logger first so handlers can be attached
    logger = logging.getLogger("aetura-engine")
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers if any
    logger.handlers = []

    # File handler with UTF-8
    fh = logging.FileHandler(log_file, encoding='utf-8')
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(fh)

    # Stream handler with UTF-8
    sh = logging.StreamHandler(original_stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(sh)
    
    sys.stdout = LoggerWriter(logger.info)
    sys.stderr = LoggerWriter(logger.error)
    return logger

logger = None
setup_logging()
logger.info("="*50)
logger.info(f"Engine starting. Python version: {sys.version}")
logger.info(f"Executable: {sys.executable}")
logger.info(f"Browsers path: {os.environ['PLAYWRIGHT_BROWSERS_PATH']}")

def is_process_running(pid: int) -> bool:
    if pid <= 0:
        return False

    if os.name == "nt":
        try:
            # PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
            process_handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
            if not process_handle:
                return False

            exit_code = ctypes.c_ulong()
            if not ctypes.windll.kernel32.GetExitCodeProcess(process_handle, ctypes.byref(exit_code)):
                ctypes.windll.kernel32.CloseHandle(process_handle)
                return False
            
            is_active = exit_code.value == 259 # STILL_ACTIVE
            ctypes.windll.kernel32.CloseHandle(process_handle)
            return is_active
        except Exception as e:
            logger.error(f"Error checking process {pid}: {e}")
            return True # Assume running if we can't check
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

def start_parent_watchdog(parent_pid: int) -> None:
    if parent_pid <= 0:
        logger.info("No parent PID provided, watchdog disabled.")
        return

    def watch_parent() -> None:
        logger.info(f"Starting watchdog for parent PID: {parent_pid}")
        while True:
            if not is_process_running(parent_pid):
                logger.info(f"Parent process {parent_pid} not found. Exiting engine.")
                os._exit(0)
            time.sleep(2)

    threading.Thread(target=watch_parent, daemon=True).start()

app = FastAPI(title="Aetura Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            "ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow",
        ]
    ] = None

def _dump_recording_settings(settings: Optional[RecordingSettingsRequest]) -> Optional[Dict[str, Any]]:
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
        "docs_url": f"http://{state.host}:{state.port}/docs",
    }

@app.post("/explore")
async def explore_website(request: ExploreRequest):
    logger.info(f"Exploring: {request.url}")
    try:
        ai_result = await draft_demo_script(request.url, request.intent, request.grok_api_key)
        with open("dev_cache.json", "w") as f:
            json.dump(ai_result, f)
        return {"status": "success", "agent_message": ai_result}
    except Exception as error:
        logger.error(f"Explore error: {error}")
        error_text = str(error).lower()
        if "rate limit" in error_text or "429" in error_text:
            raise HTTPException(status_code=429, detail=str(error)) from error
        raise HTTPException(status_code=422, detail=str(error)) from error

@app.post("/explore/resume")
async def resume_website(request: ResumeRequest):
    logger.info(f"Resuming: {request.url}")
    try:
        script_data = await resume_demo_script(request.url, request.intent, request.approved_steps, request.grok_api_key)
        return script_data
    except Exception as error:
        logger.error(f"Resume error: {error}")
        error_text = str(error).lower()
        if "rate limit" in error_text or "429" in error_text:
            raise HTTPException(status_code=429, detail=str(error)) from error
        raise HTTPException(status_code=422, detail=str(error)) from error

@app.post("/record")
async def record_website(request: RecordRequest):
    logger.info(f"Recording: {request.url}")
    try:
        full_video_path, enriched_steps = await record_demo_video(
            request.url,
            request.approved_steps,
            _dump_recording_settings(request.recording_settings),
        )
        filename = os.path.basename(full_video_path)
        return {
            "status": "success",
            "video_url": f"http://{state.host}:{state.port}/recordings/{filename}",
            "enriched_steps": enriched_steps,
        }
    except Exception as error:
        logger.error(f"Record error: {error}")
        raise HTTPException(status_code=422, detail=str(error)) from error

@app.post("/edit")
async def edit_website(request: EditRequest):
    logger.info("Editing video manifest")
    try:
        manifest = await edit_video_manifest(
            request.steps,
            request.intent,
            request.current_manifest,
            request.grok_api_key,
            request.duration,
        )
        return {"status": "success", "manifest": manifest}
    except Exception as error:
        logger.error(f"Edit error: {error}")
        return {"status": "error", "message": str(error)}

@app.get("/dev/load-cache")
async def load_dev_cache():
    try:
        with open("dev_cache.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"error": "No cache found."}

@app.get("/library")
async def get_library_videos():
    if not state.recordings_dir:
        return {"videos": []}
    video_files = list(state.recordings_dir.glob("*.mp4"))
    video_files.sort(key=os.path.getmtime, reverse=True)
    videos = []
    for file_path in video_files:
        filename = file_path.name
        videos.append({
            "filename": filename,
            "absolute_path": str(file_path),
            "video_url": f"http://{state.host}:{state.port}/recordings/{filename}",
            "created_at": os.path.getmtime(file_path),
        })
    return {"videos": videos}

def run_server():
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--port", type=int, default=8000)
        parser.add_argument("--host", default="127.0.0.1")
        parser.add_argument("--parent-pid", type=int, default=0)
        args = parser.parse_args()

        state.host = args.host
        state.port = args.port
        state.recordings_dir = get_recordings_dir()
        os.makedirs(state.recordings_dir, exist_ok=True)
        
        app.mount("/recordings", StaticFiles(directory=str(state.recordings_dir)), name="recordings")

        logger.info(f"Starting server on {args.host}:{args.port}")
        start_parent_watchdog(args.parent_pid)
        
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    except Exception as e:
        logger.error(f"FATAL ERROR DURING STARTUP: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    # Check for internal Playwright CLI delegation
    if len(sys.argv) > 1 and sys.argv[1] == "__playwright_cli__":
        try:
            import playwright.__main__
            # Remove the first two arguments (exe name and our special flag)
            # then call playwright's main
            sys.argv = [sys.argv[0]] + sys.argv[2:]
            playwright.__main__.main()
            sys.exit(0)
        except Exception as e:
            logger.error(f"Internal Playwright CLI error: {e}")
            sys.exit(1)

    run_server()
