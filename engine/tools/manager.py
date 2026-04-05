import asyncio
import json

# Define the tools exactly how OpenAI/Groq expects them
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
]


async def execute_tool(tool_call, page):
    """
    Parses the AI's tool request and executes the corresponding Playwright action.
    """
    func_name = tool_call.function.name

    try:
        args_string = tool_call.function.arguments
        args = json.loads(args_string) if args_string else {}
        # If it parsed "null", it becomes None. Force it to be a dict.
        if not isinstance(args, dict):
            args = {}
    except Exception:
        args = {}

    element_id = args.get("element_id")
    selector = f"[data-aetura-id='{element_id}']" if element_id else None

    print(f"⚡ Executing Action: {func_name} with args: {args}")

    try:
        if func_name == "finish_task":
            msg = args.get("final_message")
            print(f" Agent declared victory: {msg}")
            return f"FINISHED: {msg}"

        if func_name == "goto_url":
            target_url = args.get("url")
            print(f"🔗 Navigating to: {target_url}")
            await page.goto(target_url)
            await page.wait_for_load_state("networkidle")
            return f"Successfully navigated to {target_url}."

        # ... keep existing type_text and click_element logic ...

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

            # Defensive check: Did the AI actually give us a key to press?
            if not key_name:
                error_msg = f"Failed to press key on ID {element_id}. No 'key' argument was provided."
                print(f"❌ {error_msg}")
                return error_msg

            print(f"⌨️ Pressing '{key_name}' on ID {element_id}")

            # Playwright's .press() focuses the element and hits the key
            await page.press(selector, key_name)

            # Now this is completely safe because we know key_name is a string!
            if key_name.lower() == "enter":
                await page.wait_for_timeout(2000)

            return f"Successfully pressed '{key_name}' on ID {element_id}."

        elif func_name == "extract_text":
            print("📄 Extracting readable text from the page...")

            # Grab all visible text from the body of the page
            page_text = await page.locator("body").inner_text()

            # Clean it up: remove excessive empty lines
            import re

            page_text = re.sub(r"\n+", "\n", page_text).strip()

            # Truncate to save tokens (approx 1000 words)
            clean_text = page_text[:4000]
            if len(page_text) > 4000:
                clean_text += "\n...[Text truncated for length]"

            return f"Page Text Content:\n\n{clean_text}"

        elif func_name == "click_element":
            print(f"Clicking ID {element_id}")
            await page.click(selector)
            # Wait for any potential navigation or animations after a click
            await page.wait_for_timeout(2000)
            return f"Successfully clicked ID {element_id}."

    except Exception as e:
        error_msg = f"Failed to execute {func_name} on ID {element_id}. Error: {str(e)}"
        print(error_msg)
        return error_msg

    return f"Unknown tool: {func_name}"
