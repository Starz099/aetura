import asyncio
from browser_engine import BrowserEngine
from ai_engine import AIEngine
from tools.manager import AGENT_TOOLS, execute_tool
from tools.dom_extractor import extract_clean_dom


async def run_exploration(url: str, intent: str):
    browser = BrowserEngine()
    ai = AIEngine()

    page = await browser.start(headless=False)

    print(f"Navigating to {url}...")
    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    max_steps = 20
    step_count = 0
    final_message = ""
    memory = ""  # NEW: A place to store what the agent learns

    # The Agent Loop
    while step_count < max_steps:
        step_count += 1
        print(f"\n--- Step {step_count} ---")

        # 1. Look at the page
        dom_state = await extract_clean_dom(page)

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
            print(f"⚠️ API Error caught: {error_msg}")

            # Save the error to memory so the AI knows it made a formatting mistake
            memory += f"\n- SYSTEM ERROR: You output invalid JSON or raw tags. You must use the native JSON tool schema. Try again.\n"

            # Wait a second and let the while loop start the next step
            await asyncio.sleep(1)
            continue

        # 4. Check if the AI used a tool
        if ai_response.tool_calls:
            for tool_call in ai_response.tool_calls:
                # 5. Execute the Hands
                action_result = await execute_tool(tool_call, page)
                print(f"Action Result: {action_result}")

                # NEW: Save the result to memory so the AI can read it on the next step
                memory += (
                    f"\n- Tool '{tool_call.function.name}' returned: {action_result}\n"
                )

                # Break the loop if the AI called finish_task
                if "FINISHED:" in action_result:
                    final_message = action_result.replace("FINISHED: ", "")
                    print(f"\nAgent finished task: {final_message}")

                    # Wait 2 seconds so you can see it finished, then close
                    await asyncio.sleep(2)
                    await browser.stop()
                    return final_message

                # Wait for dynamic content to load after an action
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)
        else:
            # If no tools were called, the AI thinks it is done
            print("\nAgent finished task (No tools used):")
            print(ai_response.content)
            final_message = ai_response.content
            break

    if step_count >= max_steps:
        final_message = "Agent reached maximum steps without confirming completion."
        print(final_message)

    await asyncio.sleep(2)
    await browser.stop()

    return final_message
