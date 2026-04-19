"""Shared workflow base class and orchestration helpers."""

import asyncio
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from ai_engine import AIEngine
from browser_engine import BrowserEngine
from dom.parser import parse_dom_state
from models.script import DOMElement, Step
from tools.dom_extractor import extract_clean_dom
from tools.manager import AGENT_TOOLS, execute_tool

from .mocks import MockToolCall

WORKFLOW_TOOL_NAMES = {
    "click_element",
    "goto_url",
    "scroll_page",
    "hover_element",
    "finish_task",
}


class Workflow(ABC):
    """Abstract base class for automation workflows."""

    def __init__(self, grok_api_key: Optional[str] = None):
        self.grok_api_key = grok_api_key
        self.browser: Optional[BrowserEngine] = None
        self.ai: Optional[AIEngine] = None
        self.page: Optional[Any] = None

    async def initialize(self) -> None:
        """Initialize browser and AI engines."""
        self.browser = BrowserEngine()
        if self.grok_api_key:
            self.ai = AIEngine(self.grok_api_key)

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self.browser:
            await self.browser.stop()
            self.browser = None
        self.page = None

    @abstractmethod
    async def execute(self, *args, **kwargs) -> dict:
        """Execute the workflow. Must be implemented by subclasses."""

    async def _start_page(self, url: str, headless: bool = False) -> None:
        """Start browser page and navigate to URL."""
        assert self.browser is not None, "Browser not initialized"
        self.page = await self.browser.start(headless=headless)
        await self.page.goto(url)
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

    async def _get_dom_state(self) -> str:
        """Get current DOM state."""
        assert self.page is not None, "Page not initialized"
        return await extract_clean_dom(self.page)

    async def _extract_and_parse_dom(self) -> tuple[str, List[DOMElement]]:
        """Extract and parse DOM from page."""
        dom_state = await self._get_dom_state()
        parsed_dom = parse_dom_state(dom_state)
        return dom_state, parsed_dom

    @staticmethod
    def _summarize_progress(steps: List[Step], limit: int = 6) -> str:
        """Summarize completed actions for the next model turn."""
        if not steps:
            return "No steps completed yet."

        summaries = []
        for step in steps[-limit:]:
            action = step.action_taken
            args = json.dumps(action.arguments, sort_keys=True)
            summaries.append(
                f"Step {step.step_number}: {action.tool_name}({args}) on {step.current_url}"
            )

        return "\n".join(summaries)

    @staticmethod
    def _format_dom_context(parsed_dom: List[DOMElement], limit: int = 18) -> str:
        """Format a compact page summary for the model."""
        if not parsed_dom:
            return "No interactive elements found."

        lines = []
        if len(parsed_dom) > limit:
            head_count = limit // 2
            tail_count = limit - head_count
            dom_slice = parsed_dom[:head_count] + parsed_dom[-tail_count:]
        else:
            dom_slice = parsed_dom

        for element in dom_slice:
            line = f"[ID {element.element_id}] {element.element_type}: {element.text}"
            if element.href:
                line += f" -> {element.href}"
            lines.append(line)

        if len(parsed_dom) > limit:
            lines.insert(limit // 2, "... (middle elements omitted) ...")

        return "\n".join(lines)

    @staticmethod
    def _summarize_tool_result(result: Any, limit: int = 220) -> str:
        """Keep tool results short so the memory log stays bounded."""
        text = str(result).replace("\n", " ").strip()
        if len(text) <= limit:
            return text
        return text[:limit].rstrip() + "..."

    @staticmethod
    def _trim_memory_entries(entries: List[str], keep_last: int = 6) -> List[str]:
        """Keep only the most recent memory entries."""
        if len(entries) <= keep_last:
            return entries
        return entries[-keep_last:]

    async def _page_snapshot(self, url: str, webpage_context: str) -> str:
        """Create a progress signature using both DOM context and scroll state."""
        scroll_signature = "scroll=unknown"
        if self.page is not None:
            try:
                scroll = await self.page.evaluate(
                    """
                    () => {
                        const y = Math.round(window.scrollY || 0);
                        const max = Math.max(
                            0,
                            Math.round((document.documentElement.scrollHeight || document.body.scrollHeight || 0) - window.innerHeight)
                        );
                        const nearBottom = max > 0 ? y >= max - 24 : true;
                        return `${y}/${max}/${nearBottom ? 1 : 0}`;
                    }
                    """
                )
                scroll_signature = f"scroll={scroll}"
            except Exception:
                pass

        return f"{url}\n{scroll_signature}\n{webpage_context}"

    @staticmethod
    def _goal_requires_like_click(intent: str) -> bool:
        """Detect whether the intent explicitly requires clicking like."""
        lowered = intent.lower()
        return "like" in lowered

    @staticmethod
    def _did_click_like(steps: List[Step]) -> bool:
        """Check whether any click step targeted an element labeled like."""
        for step in steps:
            if step.action_taken.tool_name != "click_element":
                continue

            element_id = step.action_taken.arguments.get("element_id")
            if element_id is None:
                continue

            for element in step.available_elements:
                if element.element_id == element_id and "like" in element.text.lower():
                    return True

        return False

    @staticmethod
    def _normalize_tool_arguments(arguments: Any) -> Dict[str, Any]:
        """Coerce model tool arguments into a plain dictionary."""
        if isinstance(arguments, dict):
            return arguments

        if isinstance(arguments, str):
            try:
                parsed_arguments = json.loads(arguments)
            except Exception:
                return {}

            return parsed_arguments if isinstance(parsed_arguments, dict) else {}

        return {}

    @staticmethod
    def _tool_signature(tool_name: str, arguments: Dict[str, Any], url: str) -> str:
        """Build a compact repeat-detection signature."""
        return f"{url}::{tool_name}::{json.dumps(arguments, sort_keys=True)}"

    @staticmethod
    def _filter_workflow_tools(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Limit the model to the small action set it actually needs."""
        return [
            tool
            for tool in tools
            if tool.get("function", {}).get("name") in WORKFLOW_TOOL_NAMES
        ]

    async def _get_ai_decision(self, system_prompt: str, user_prompt: str) -> Any:
        """Get AI decision on next action."""
        assert self.ai is not None, "AI engine not initialized"
        return await self.ai.get_decision(
            system_prompt,
            user_prompt,
            self._filter_workflow_tools(AGENT_TOOLS),
        )

    async def _execute_tool_call(self, tool_call: Any) -> str:
        """Execute a tool call and return result."""
        assert self.page is not None, "Page not initialized"
        return await execute_tool(tool_call, self.page)

    async def _replay_approved_steps(
        self,
        steps: List[Dict[str, Any]],
    ) -> tuple[int, str, List[Step]]:
        """
        Replay approved steps and return step count, memory, and script steps.

        Args:
            steps: List of approved steps to replay

        Returns:
            Tuple of (step_count, memory, script_steps)
        """
        step_count = 0
        memory = ""
        script_steps = []

        print(f"\n[Replaying {len(steps)} approved steps...]")
        for step_data in steps:
            step_count += 1
            print(f"Replaying Step {step_count}...")

            _, _ = await self._extract_and_parse_dom()

            action_name = step_data["action_taken"]["tool_name"]
            action_args = step_data["action_taken"]["arguments"]

            mock_call = MockToolCall(action_name, action_args)
            action_result = await self._execute_tool_call(mock_call)

            script_steps.append(Step(**step_data))
            memory += f"\n- Tool '{action_name}' returned: {action_result}\n"

            assert self.page is not None
            await self.page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)

        return step_count, memory, script_steps
