import asyncio
import subprocess
import sys
from playwright.async_api import async_playwright, Error as PlaywrightError


class BrowserEngine:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.page = None

    async def start(self, headless=False):
        print("Starting Browser Engine...")
        self.playwright = await async_playwright().start()
        
        try:
            self.browser = await self.playwright.chromium.launch(
                headless=headless,
                args=["--disable-gpu", "--disable-dev-shm-usage"],
            )
        except PlaywrightError as e:
            if "Executable doesn't exist" in str(e) or "not found" in str(e).lower():
                print("Chromium not found. Attempting to install...")
                try:
                    # Run internal playwright CLI delegation
                    subprocess.run(
                        [sys.executable, "__playwright_cli__", "install", "chromium"],
                        check=True,
                        capture_output=True,
                        text=True
                    )
                    print("Chromium installed successfully. Retrying launch...")
                    self.browser = await self.playwright.chromium.launch(
                        headless=headless,
                        args=["--disable-gpu", "--disable-dev-shm-usage"],
                    )
                except Exception as install_error:
                    raise RuntimeError(
                        f"Failed to auto-install Chromium: {install_error}. "
                        "Please run 'playwright install chromium' manually."
                    ) from install_error
            else:
                raise e

        self.page = await self.browser.new_page()
        return self.page

    async def stop(self):
        print("Shutting down Browser Engine...")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
