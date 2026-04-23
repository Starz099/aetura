"""Draft workflow implementation."""

import asyncio

from models.script import DemoScript
from prompts import WorkflowPrompts

from .base import Workflow


class DraftWorkflow(Workflow):
    """Workflow for drafting new automation scripts from scratch."""

    async def execute(self, url: str, intent: str, grok_api_key: str) -> dict:
        """Draft a new automation script."""
        self.grok_api_key = grok_api_key
        await self.initialize()

        try:
            await self._start_page(url, headless=False)

            _, script_steps = await self._run_ai_steps(
                intent=intent,
                step_count=0,
                max_steps=20,
                script_steps=[],
                prompt_builder=WorkflowPrompts.get_draft_prompt,
                memory_empty_message="No previous actions.",
                api_error_message="- SYSTEM ERROR: Invalid response. Retrying.",
                print_action_result=True,
                print_finished_message=True,
                print_no_tool_message=True,
            )

            await asyncio.sleep(2)

            script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
            return script.model_dump()

        finally:
            await self.cleanup()
