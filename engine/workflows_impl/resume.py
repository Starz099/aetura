"""Resume workflow implementation."""

import asyncio
from typing import Dict, List

from models.script import Action, DemoScript, Step
from prompts import WorkflowPrompts

from .base import Workflow


class ResumeWorkflow(Workflow):
    """Workflow for resuming interrupted automation scripts."""

    async def execute(
        self,
        url: str,
        intent: str,
        approved_steps: List[Dict[str, object]],
        grok_api_key: str,
    ) -> dict:
        """Resume an automation script from approved steps."""
        self.grok_api_key = grok_api_key
        await self.initialize()

        try:
            await self._start_page(url, headless=False)

            # Replay approved steps
            step_count, _, script_steps = await self._replay_approved_steps(approved_steps)

            # Let AI continue from here
            max_steps = 15
            max_attempts = max_steps * 3
            attempt_count = 0
            memory_entries: List[str] = []
            previous_snapshot = ""
            stagnant_count = 0
            last_action_signature = ""
            same_action_no_progress_count = 0
            print("\n[AI taking over for remaining steps...]")

            while step_count < max_steps:
                attempt_count += 1
                if attempt_count > max_attempts:
                    raise RuntimeError("Workflow stalled after too many attempts.")

                next_step_number = step_count + 1
                print(f"\n--- Step {next_step_number} (AI) ---")

                _, parsed_dom = await self._extract_and_parse_dom()
                system_prompt, user_prompt = WorkflowPrompts.get_resume_prompt(
                    intent,
                    "Previous steps completed",
                )
                webpage_context = self._format_dom_context(parsed_dom)
                progress_context = self._summarize_progress(script_steps)

                user_prompt += f"\n\nCurrent URL: {self.page.url}\n"
                user_prompt += f"--- COMPLETED STEPS ---\n{progress_context}\n"
                user_prompt += (
                    "--- MEMORY LOG ---\n"
                    f"{chr(10).join(memory_entries) if memory_entries else 'No actions yet.'}\n"
                )
                user_prompt += f"--- CURRENT WEBPAGE ---\n{webpage_context}\n"

                try:
                    ai_response = await self._get_ai_decision(system_prompt, user_prompt)
                except Exception as error:
                    print(f"API Error: {str(error)}")
                    memory_entries.append("- SYSTEM ERROR: Retrying.")
                    memory_entries = self._trim_memory_entries(memory_entries)
                    await asyncio.sleep(1)
                    continue

                if ai_response.tool_calls:
                    tool_call = ai_response.tool_calls[0]
                    args = self._normalize_tool_arguments(tool_call.function.arguments)
                    action_signature = self._tool_signature(
                        tool_call.function.name,
                        args,
                        self.page.url,
                    )

                    action_result = await self._execute_tool_call(tool_call)

                    action = Action(
                        tool_name=tool_call.function.name,
                        arguments=args,
                        description=f"Used {tool_call.function.name}",
                    )

                    step = Step(
                        step_number=next_step_number,
                        current_url=self.page.url,
                        action_taken=action,
                        available_elements=parsed_dom,
                    )
                    script_steps.append(step)
                    memory_entries.append(
                        f"- Tool '{tool_call.function.name}' returned: {self._summarize_tool_result(action_result)}"
                    )
                    memory_entries = self._trim_memory_entries(memory_entries)
                    step_count = next_step_number

                    # Re-read page state after the action to detect real progress.
                    _, post_parsed_dom = await self._extract_and_parse_dom()
                    post_context = self._format_dom_context(post_parsed_dom)
                    current_snapshot = await self._page_snapshot(self.page.url, post_context)

                    if (
                        action_signature == last_action_signature
                        and current_snapshot == previous_snapshot
                    ):
                        same_action_no_progress_count += 1
                    else:
                        same_action_no_progress_count = 0
                    last_action_signature = action_signature

                    if current_snapshot == previous_snapshot:
                        stagnant_count += 1
                    else:
                        stagnant_count = 0
                    previous_snapshot = current_snapshot

                    if same_action_no_progress_count >= 3:
                        print("Workflow stalled: repeating same action without progress.")
                        break

                    if stagnant_count >= 4:
                        print("Workflow stalled: page state is not changing.")
                        break

                    if "FINISHED:" in action_result:
                        if self._goal_requires_like_click(intent) and not self._did_click_like(
                            script_steps,
                        ):
                            memory_entries.append(
                                "- SYSTEM: finish_task rejected. You must click a Like button before finishing.",
                            )
                            memory_entries = self._trim_memory_entries(memory_entries)
                            await asyncio.sleep(1)
                            continue

                        break

                    await self.page.wait_for_load_state("networkidle")
                    await asyncio.sleep(1)
                else:
                    break

            await asyncio.sleep(2)

            script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
            return script.model_dump()

        finally:
            await self.cleanup()
