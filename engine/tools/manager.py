import asyncio
import json

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "click_element",
            "description": "Clicks an element on the webpage using its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the element to click.",
                    }
                },
                "required": ["element_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "type_text",
            "description": "Types text into an input field using its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the input field.",
                    },
                    "text": {
                        "type": "string",
                        "description": "The exact text to type.",
                    },
                },
                "required": ["element_id", "text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "goto_url",
            "description": "Navigates the browser to a specific URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL to navigate to (e.g., https://example.com).",
                    }
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finish_task",
            "description": "Call this tool when the user's intent has been successfully completed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "final_message": {
                        "type": "string",
                        "description": "A message explaining what was accomplished.",
                    }
                },
                "required": ["final_message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "press_key",
            "description": "Simulates pressing a physical keyboard key on a specific element (e.g., hitting 'Enter' after typing).",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the element to focus on before pressing the key.",
                    },
                    "key": {
                        "type": "string",
                        "description": "The name of the key to press (e.g., 'Enter', 'Escape', 'Tab', 'ArrowDown').",
                    },
                },
                "required": ["element_id", "key"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "extract_text",
            "description": "Extracts the readable paragraph and heading text from the current webpage. Use this when you need to read an article, find specific data, or summarize a page.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "scroll_page",
            "description": "Scrolls the webpage. Use 'down' or 'up' for a single screen height. Use 'bottom' or 'top' to jump all the way to the ends of the page.",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["down", "up", "bottom", "top"],
                        "description": "The direction to scroll.",
                    }
                },
                "required": ["direction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "hover_element",
            "description": "Hovers the mouse cursor over an element using its ID. Use this to reveal hidden drop-down menus, tooltips, or expanding UI elements.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the element to hover over.",
                    }
                },
                "required": ["element_id"],
            },
        },
    },
]


async def execute_tool(tool_call, page):
    """
    Parses the AI's tool request and executes the corresponding Playwright action.
    """
    func_name = tool_call.function.name

    try:
        args_string = tool_call.function.arguments
        args = json.loads(args_string) if args_string else {}
        if not isinstance(args, dict):
            args = {}
    except Exception:
        args = {}

    element_id = args.get("element_id")
    selector = f"[data-aetura-id='{element_id}']" if element_id else None

    print(f"Executing Action: {func_name} with args: {args}")

    try:
        if func_name == "finish_task":
            msg = args.get("final_message")
            print(f"Agent declared victory: {msg}")
            return f"FINISHED: {msg}"

        if func_name == "goto_url":
            target_url = args.get("url")
            print(f"Navigating to: {target_url}")
            await page.goto(target_url)
            await page.wait_for_load_state("networkidle")
            return f"Successfully navigated to {target_url}."

        element_id = args.get("element_id")
        selector = f"[data-aetura-id='{element_id}']"

        if func_name == "type_text":
            text_to_type = args.get("text")
            print(f"Typing: '{text_to_type}'")
            await page.fill(selector, text_to_type)
            await asyncio.sleep(0.5)
            return f"Successfully typed '{text_to_type}' into ID {element_id}."

        elif func_name == "press_key":
            key_name = args.get("key")
            if not key_name:
                error_msg = f"Failed to press key on ID {element_id}. No 'key' argument was provided."
                print(f"{error_msg}")
                return error_msg

            print(f"Pressing '{key_name}' on ID {element_id}")
            await page.press(selector, key_name)
            if key_name.lower() == "enter":
                await page.wait_for_timeout(2000)

            return f"Successfully pressed '{key_name}' on ID {element_id}."

        elif func_name == "hover_element":
            element_id = args.get("element_id")
            if not element_id:
                error_msg = f"Failed to hover. No 'element_id' argument was provided."
                print(f"{error_msg}")
                return error_msg

            selector = f"[data-aetura-id='{element_id}']"
            print(f"Hovering over ID {element_id}...")
            await page.hover(selector)
            await asyncio.sleep(1.5)

            return f"Successfully hovered over ID {element_id}."

        elif func_name == "extract_text":
            print("Extracting readable text from the page...")
            page_text = await page.locator("body").inner_text()
            import re

            page_text = re.sub(r"\n+", "\n", page_text).strip()

            clean_text = page_text[:4000]
            if len(page_text) > 4000:
                clean_text += "\n...[Text truncated for length]"

            return f"Page Text Content:\n\n{clean_text}"

        elif func_name == "scroll_page":
            direction = args.get("direction", "down").lower()
            print(f"Scrolling page {direction} smoothly...")
            if direction == "up":
                await page.evaluate(
                    "window.scrollBy({ top: -window.innerHeight, left: 0, behavior: 'smooth' })"
                )
            elif direction == "bottom":
                await page.evaluate(
                    "window.scrollTo({ top: document.body.scrollHeight, left: 0, behavior: 'smooth' })"
                )
            elif direction == "top":
                await page.evaluate(
                    "window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })"
                )
            else:
                await page.evaluate(
                    "window.scrollBy({ top: window.innerHeight, left: 0, behavior: 'smooth' })"
                )

            await asyncio.sleep(1.5)
            return f"Successfully scrolled the page {direction}."

        elif func_name == "click_element":
            print(f"Clicking ID {element_id}")
            await page.click(selector)
            await page.wait_for_timeout(2000)
            return f"Successfully clicked ID {element_id}."

    except Exception as e:
        error_msg = f"Failed to execute {func_name} on ID {element_id}. Error: {str(e)}"
        print(error_msg)
        return error_msg

    return f"Unknown tool: {func_name}"
