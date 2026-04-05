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

    max_steps = 5
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
            "You are a web automation agent. "
            "You MUST use the native JSON tool calling feature to take actions. "
            "NEVER output raw text tags like <function=...>. "
            "Use the provided tools to fulfill the user's intent. "
            "CRITICAL: If the intent is already fulfilled, you MUST use the 'finish_task' tool to stop."
        )

        # NEW: We are injecting the 'Memory' into the prompt so it doesn't forget
        user_prompt = (
            f"The user wants to: '{intent}'.\n\n"
            f"Current URL: {page.url}\n"
            f"Memory of previous actions:\n{memory}\n\n"
            f"Here is the current state of the webpage:\n{dom_state}\n\n"
            "What is your next action?"
        )

        # 3. Ask the Brain
        ai_response = await ai.get_decision(system_prompt, user_prompt, AGENT_TOOLS)

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
