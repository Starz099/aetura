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
]


async def execute_tool(tool_call, page):
    """
    Parses the AI's tool request and executes the corresponding Playwright action.
    """
    func_name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    element_id = args.get("element_id")

    # We use the custom attribute we injected via JavaScript
    selector = f"[data-aetura-id='{element_id}']"

    print(f"Executing Action: {func_name} on ID {element_id}")

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
