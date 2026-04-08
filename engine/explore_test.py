import asyncio
import subprocess

from browser_use import Agent, Browser, ChatOllama


async def main():
    wsl_host_ip = (
        subprocess.check_output("ip route list default | awk '{print $3}'", shell=True)
        .decode("utf-8")
        .strip()
    )
    windows_ollama_url = f"http://{wsl_host_ip}:11434"

    llm = ChatOllama(model="llama3.2-vision", host=windows_ollama_url)

    browser = Browser(headless=True)

    agent = Agent(
        task="Go to google.com and search for 'Open Source LLMs'",
        llm=llm,
        browser=browser,
    )

    print("Starting agent...")
    history = await agent.run()

    print("\n--- RESULTS ---")
    print(history.final_result())

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
