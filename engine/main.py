import os
import glob
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from orchestrator import draft_demo_script, resume_demo_script, record_demo_video
from typing import List, Any, Optional, Literal, Dict
from fastapi.staticfiles import StaticFiles

# Define data directory for persistence across installations
DATA_DIR = os.environ.get("AETURA_DATA_DIR", os.getcwd())
RECORDINGS_DIR = os.path.join(DATA_DIR, "recordings")
CACHE_FILE = os.path.join(DATA_DIR, "dev_cache.json")

os.makedirs(RECORDINGS_DIR, exist_ok=True)
app = FastAPI(title="Aetura Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/recordings", StaticFiles(directory=RECORDINGS_DIR), name="recordings")


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


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Aetura Engine API.",
        "status": "online",
        "docs_url": "http://127.0.0.1:8000/docs",
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

    with open(CACHE_FILE, "w") as f:
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
        full_video_path = await record_demo_video(
            request.url,
            request.approved_steps,
            _dump_recording_settings(request.recording_settings),
        )
    except Exception as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    filename = os.path.basename(full_video_path)
    return {
        "status": "success",
        "video_url": f"http://localhost:8000/recordings/{filename}",
    }


@app.get("/dev/load-cache")
async def load_dev_cache():
    try:
        with open(CACHE_FILE, "r") as f:
            cached_data = json.load(f)
            return cached_data
    except FileNotFoundError:
        return {"error": "No cache found. Run a real mapping first."}


@app.get("/library")
async def get_library_videos():
    """Returns recorded videos with both local path and preview URL."""
    # Ensure the folder exists
    os.makedirs(RECORDINGS_DIR, exist_ok=True)

    # Get all mp4 files in the folder
    search_path = os.path.abspath(os.path.join(RECORDINGS_DIR, "*.mp4"))
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
                "video_url": f"http://localhost:8000/recordings/{filename}",
                "created_at": os.path.getmtime(file_path),
            }
        )

    return {"videos": videos}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
