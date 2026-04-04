import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Clean imports - no extra config classes needed!
from browser_use import Agent, Browser, ChatOllama

wsl_host_ip = (
    subprocess.check_output("ip route list default | awk '{print $3}'", shell=True)
    .decode("utf-8")
    .strip()
)
windows_ollama_url = f"http://{wsl_host_ip}:11434"

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


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Aetura Engine API. Use /explore to explore websites."
    }


@app.post("/explore")
async def explore_website(request: ExploreRequest):
    print(f"Received request to explore: {request.url}")

    llm = ChatOllama(
        model="llama3.2-vision",
        host=windows_ollama_url,
        ollama_options={"num_ctx": 16000},
    )

    # Just passing headless=False directly is all we need!
    browser = Browser(headless=False)

    agent = Agent(
        task=f"Go to {request.url} and {request.intent}",
        llm=llm,
        browser=browser,
    )

    print("Agent is starting the browser...")
    history = await agent.run()

    await browser.close()  # type: ignore

    return {"status": "success", "final_outcome": history.final_result()}
