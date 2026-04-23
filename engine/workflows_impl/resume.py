"""Resume workflow implementation."""

import asyncio
from typing import Dict, List

from models.script import DemoScript
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
            step_count, script_steps = await self._replay_approved_steps(approved_steps)

            # Let AI continue from here
            max_steps = 15
            _, script_steps = await self._run_ai_steps(
                intent=intent,
                step_count=step_count,
                max_steps=max_steps,
                script_steps=script_steps,
                prompt_builder=lambda goal: WorkflowPrompts.get_resume_prompt(
                    goal,
                    "Previous steps completed",
                ),
                memory_empty_message="No actions yet.",
                api_error_message="- SYSTEM ERROR: Retrying.",
                step_label_suffix=" (AI)",
                announce_message="\n[AI taking over for remaining steps...]",
            )

            await asyncio.sleep(2)

            script = DemoScript(goal=intent, starting_url=url, steps=script_steps)
            return script.model_dump()

        finally:
            await self.cleanup()
