import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from orchestrator import draft_demo_script, resume_demo_script, record_demo_video
from typing import List, Any
from fastapi.staticfiles import StaticFiles

os.makedirs("recordings", exist_ok=True)
app = FastAPI(title="Aetura Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/recordings", StaticFiles(directory="recordings"), name="recordings")


class ExploreRequest(BaseModel):
    url: str
    intent: str


class ResumeRequest(BaseModel):
    url: str
    intent: str
    approved_steps: List[Any]


class RecordRequest(BaseModel):
    url: str
    approved_steps: List[Any]


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
    ai_result = await draft_demo_script(request.url, request.intent)
    with open("dev_cache.json", "w") as f:
        json.dump(ai_result, f)

    return {"status": "success", "agent_message": ai_result}


@app.post("/explore/resume")
async def resume_website(request: ResumeRequest):
    print(f"Resuming script for: {request.url}")
    script_data = await resume_demo_script(
        request.url, request.intent, request.approved_steps
    )
    return script_data


@app.post("/record")
async def record_website(request: RecordRequest):
    print(f"Received API request to record: {request.url}")
    full_video_path = await record_demo_video(request.url, request.approved_steps)
    filename = os.path.basename(full_video_path)
    return {
        "status": "success",
        "video_url": f"http://localhost:8000/recordings/{filename}",
    }


@app.get("/dev/load-cache")
async def load_dev_cache():
    try:
        with open("dev_cache.json", "r") as f:
            cached_data = json.load(f)
            return cached_data
    except FileNotFoundError:
        return {"error": "No cache found. Run a real mapping first."}
