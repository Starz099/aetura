from playwright.async_api import async_playwright


class BrowserEngine:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.page = None

    async def start(self, headless=False):
        print("Starting Browser Engine...")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=["--disable-gpu", "--disable-dev-shm-usage"],
        )
        self.page = await self.browser.new_page()
        return self.page

    async def stop(self):
        print("Shutting down Browser Engine...")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
