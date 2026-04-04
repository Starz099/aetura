import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import ChatGoogle directly from browser_use!
from browser_use import Agent, Browser, ChatGoogle

# Set your API Key here
os.environ["GOOGLE_API_KEY"] = ""

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


@app.post("/explore")
async def explore_website(request: ExploreRequest):
    print(f"Received request to explore: {request.url}")

    # Use the built-in browser-use wrapper for Gemini
    llm = ChatGoogle(model="gemini-2.0-flash")

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
