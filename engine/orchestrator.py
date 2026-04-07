import asyncio
import json
import re
from browser_engine import BrowserEngine
from ai_engine import AIEngine
from tools.manager import AGENT_TOOLS, execute_tool
from tools.dom_extractor import extract_clean_dom
from models.script import DOMElement, Action, Step, DemoScript
import os
from playwright.async_api import async_playwright


class MockFunction:
    def __init__(self, name, arguments):
        self.name = name
        self.arguments = json.dumps(arguments)


class MockToolCall:
    def __init__(self, name, arguments):
        self.function = MockFunction(name, arguments)


def parse_dom_state(dom_string: str) -> list[DOMElement]:
    """Helper to convert the raw DOM text into structured Pydantic objects for the frontend."""
    elements = []
    if not dom_string:
        return elements

    for line in dom_string.strip().split("\n"):
        # Regex to extract ID, type, optional href, and text
        # Handles formats like: [ID: 8] a [href="/blog"] - "Read more"
        match = re.match(
            r'\[ID:\s*(\d+)\]\s*([a-zA-Z0-9_\[\]="]+)(?:\s+\[href="([^"]+)"\])?\s*-\s*"(.*)"',
            line,
        )
        if match:
            el_id, el_type, href, text = match.groups()
            elements.append(
                DOMElement(
                    element_id=int(el_id), element_type=el_type, text=text, href=href
                )
            )
    return elements


async def draft_demo_script(url: str, intent: str) -> dict:
    """Runs the audit and returns a structured DemoScript JSON for the React UI."""
    browser = BrowserEngine()
    ai = AIEngine()

    page = await browser.start(headless=False)
    print(f"Navigating to {url}...")
    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    max_steps = 20
    step_count = 0
    memory = ""  # NEW: A place to store what the agent learns

    script_steps = []
    # The Agent Loop
    while step_count < max_steps:
        step_count += 1
        print(f"\n--- Step {step_count} ---")

        # 1. Look at the page
        dom_state = await extract_clean_dom(page)
        parsed_dom_elements = parse_dom_state(dom_state)

        # 2. Build the prompts
        system_prompt = (
            "You are an autonomous web automation agent. "
            "You MUST use the provided JSON tools to take actions. "
            "NEVER output raw text tags like <function=...>. "
            "NEVER write out JSON tool calls in your normal text response. You must trigger the actual tool function. "
            "If you receive a SYSTEM ERROR regarding invalid JSON, you must carefully re-format your NEXT tool call to strictly match the schema. "
            "CRITICAL RULES: "
            "1. NEVER call the exact same tool twice in a row if the state hasn't changed. "
            "2. If you just called 'extract_text', the content is NOW IN YOUR MEMORY. DO NOT call 'extract_text' again! Read your memory instead. "
            "3. Once you have read the extracted text in your memory and can fulfill the user's intent, you MUST immediately call 'finish_task'."
        )

        # NEW: Injecting a much clearer memory structure
        user_prompt = (
            f"The user wants to: '{intent}'.\n\n"
            f"Current URL: {page.url}\n\n"
            f"--- MEMORY LOG (Read this carefully to avoid repeating actions)---\n"
            f"{memory if memory else 'No previous actions.'}\n"
            f"------------------\n\n"
            f"--- CURRENT WEBPAGE (Clickable Elements Only)---\n"
            f"{dom_state}\n"
            f"-----------------------\n\n"
            "What is your next action? If the information you need is already in your MEMORY LOG, call 'finish_task' immediately!"
        )
        # 3. Ask the Brain (NOW BULLETPROOFED)
        try:
            ai_response = await ai.get_decision(system_prompt, user_prompt, AGENT_TOOLS)
        except Exception as e:
            # If Groq throws a 400 error due to hallucinated tags, we catch it!
            error_msg = str(e)
            print(f"API Error caught: {error_msg}")

            # Save the error to memory so the AI knows it made a formatting mistake
            memory += f"\n- SYSTEM ERROR: You output invalid JSON or raw tags. You must use the native JSON tool schema. Try again.\n"

            # Wait a second and let the while loop start the next step
            await asyncio.sleep(1)
            continue

        # 4. Check if the AI used a tool
        if ai_response.tool_calls:
            # We'll assume the AI takes one action per step for clean mapping
            tool_call = ai_response.tool_calls[0]

            action_result = await execute_tool(tool_call, page)
            print(f"Action Result: {action_result}")

            # NEW: Record the action for the frontend UI
            try:
                args = json.loads(tool_call.function.arguments)
            except:
                args = {}

            current_action = Action(
                tool_name=tool_call.function.name,
                arguments=args,
                description=f"Used {tool_call.function.name}",
            )

            current_step = Step(
                step_number=step_count,
                current_url=page.url,
                action_taken=current_action,
                available_elements=parsed_dom_elements,
            )
            script_steps.append(current_step)

            memory += (
                f"\n- Tool '{tool_call.function.name}' returned: {action_result}\n"
            )

            if "FINISHED:" in action_result:
                print("\nAgent finished task.")
                break

            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
        else:
            print("\nAgent finished task (No tools used).")
            break

    await asyncio.sleep(2)
    await browser.stop()

    # NEW: Package everything into the final Pydantic model
    final_script = DemoScript(goal=intent, starting_url=url, steps=script_steps)

    # Return as a standard Python dict so FastAPI can easily convert it to JSON
    return final_script.model_dump()


async def resume_demo_script(url: str, intent: str, approved_steps: list) -> dict:
    """Fast-forwards through approved steps, then lets AI finish the rest."""
    browser = BrowserEngine()
    ai = AIEngine()

    page = await browser.start(headless=False)
    print(f" Fast-forwarding to resume point for: {url}")
    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    max_steps = 15
    step_count = 0
    memory = ""
    script_steps = []

    print("\n[PHASE 1: Replaying approved steps...]")
    for step_data in approved_steps:
        step_count += 1
        print(f"Replaying Step {step_count}...")

        # 1. We MUST run the extractor to inject the data-aetura-ids into the page!
        dom_state = await extract_clean_dom(page)
        parsed_dom = parse_dom_state(dom_state)

        # 2. Extract the approved action from the frontend's payload
        action_name = step_data["action_taken"]["tool_name"]
        action_args = step_data["action_taken"]["arguments"]

        # 3. Create a fake AI tool call and execute it
        mock_call = MockToolCall(action_name, action_args)
        action_result = await execute_tool(mock_call, page)

        # 4. Rebuild the Pydantic Step and save to memory
        script_steps.append(Step(**step_data))
        memory += f"\n- Tool '{action_name}' returned: {action_result}\n"

        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

    # --- PHASE 2: AI TAKEOVER ---
    print("\n[PHASE 2: AI taking over for remaining steps...]")
    while step_count < max_steps:
        step_count += 1
        print(f"\n--- Step {step_count} (AI) ---")

        dom_state = await extract_clean_dom(page)
        parsed_dom_elements = parse_dom_state(dom_state)

        # Build prompts exactly like draft_demo_script
        system_prompt = (
            "You are an autonomous web automation agent. You MUST use the provided JSON tools. "
            "NEVER output raw text tags. "
            "1. NEVER call the exact same tool twice in a row if state hasn't changed. "
            "2. If you called 'extract_text', read your memory. DO NOT call it again. "
            "3. Call 'finish_task' when the intent is fulfilled."
        )

        user_prompt = (
            f"The user wants to: '{intent}'.\n\n"
            f"Current URL: {page.url}\n\n"
            f"--- MEMORY LOG ---\n{memory if memory else 'No previous actions.'}\n------------------\n\n"
            f"--- CURRENT WEBPAGE ---\n{dom_state}\n-----------------------\n\n"
            "What is your next action?"
        )

        try:
            ai_response = await ai.get_decision(system_prompt, user_prompt, AGENT_TOOLS)
        except Exception as e:
            print(f"⚠️ API Error caught: {str(e)}")
            memory += f"\n- SYSTEM ERROR: Invalid JSON. Try again.\n"
            await asyncio.sleep(1)
            continue

        if ai_response.tool_calls:
            tool_call = ai_response.tool_calls[0]
            action_result = await execute_tool(tool_call, page)

            try:
                args = json.loads(tool_call.function.arguments)
            except:
                args = {}

            current_action = Action(
                tool_name=tool_call.function.name,
                arguments=args,
                description=f"Used {tool_call.function.name}",
            )

            current_step = Step(
                step_number=step_count,
                current_url=page.url,
                action_taken=current_action,
                available_elements=parsed_dom_elements,
            )
            script_steps.append(current_step)
            memory += (
                f"\n- Tool '{tool_call.function.name}' returned: {action_result}\n"
            )

            if "FINISHED:" in action_result:
                break
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
        else:
            break

    await asyncio.sleep(2)
    await browser.stop()

    final_script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
    return final_script.model_dump()


async def record_demo_video(url: str, approved_steps: list) -> str:
    """Runs the deterministic loop WITHOUT AI and records a video of the execution."""

    # Ensure the recordings folder exists
    os.makedirs("recordings", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir="recordings/",
            record_video_size={"width": 1920, "height": 1080},
            device_scale_factor=2,
        )
        page = await context.new_page()

        print(f"\n Starting recording for: {url}")
        await page.goto(url)
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        step_count = 0
        for step_data in approved_steps:
            step_count += 1
            print(f" Recording Step {step_count}...")

            # 1. Run the DOM extractor JUST to inject the data-aetura-ids into the page
            await extract_clean_dom(page)

            # 2. Extract the approved action from the React payload
            action_name = step_data["action_taken"]["tool_name"]
            action_args = step_data["action_taken"]["arguments"]

            # 3. Create a fake AI tool call and execute it instantly
            mock_call = MockToolCall(action_name, action_args)
            await execute_tool(mock_call, page)

            # Wait for any animations to finish so the video looks smooth
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1.5)

        # Close the context to finalize and save the .webm video file
        video_path = await page.video.path()
        await context.close()
        await browser.close()

        print(f" Video successfully saved to: {video_path}")
        return video_path
