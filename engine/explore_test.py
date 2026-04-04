import asyncio
import subprocess

# Notice we are importing ChatOllama from browser_use now!
from browser_use import Agent, Browser, ChatOllama


async def main():
    # 1. Get Windows IP
    wsl_host_ip = (
        subprocess.check_output("ip route list default | awk '{print $3}'", shell=True)
        .decode("utf-8")
        .strip()
    )
    windows_ollama_url = f"http://{wsl_host_ip}:11434"

    # 2. Setup Vision Model (Using the built-in browser-use wrapper)
    # Note: Their custom wrapper uses 'host' instead of 'base_url'
    llm = ChatOllama(model="llama3.2-vision", host=windows_ollama_url)

    # 3. Configure Headless Browser
    browser = Browser(headless=True)

    # 4. Define the Agent
    agent = Agent(
        task="Go to google.com and search for 'Open Source LLMs'",
        llm=llm,
        browser=browser,
    )

    print("Starting agent... it will take a moment to 'see' the first frame.")
    history = await agent.run()

    print("\n--- RESULTS ---")
    print(history.final_result())

    # Clean up the browser instance
    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
