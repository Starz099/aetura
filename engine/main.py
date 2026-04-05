# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from orchestrator import run_exploration

app = FastAPI(title="Aetura Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExploreRequest(BaseModel):
    url: str
    intent: str


# --- THE NEW ROOT ROUTE ---
@app.get("/")
async def root():
    return {
        "message": "Welcome to the Aetura Engine API.",
        "status": "online",
        "docs_url": "http://127.0.0.1:8000/docs",
    }


# --- THE AGENT ROUTE ---
@app.post("/explore")
async def explore_website(request: ExploreRequest):
    print(f" Received API request to explore: {request.url}")

    # Trigger the agent!
    ai_result = await run_exploration(request.url, request.intent)

    return {"status": "success", "agent_message": ai_result}
