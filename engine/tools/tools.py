"""
Tool implementations - individual tool classes.
"""
import asyncio
import json
import re
from typing import Any, Dict, Optional

from .base import Tool, ToolSchema, ToolExecutionResult, ToolExecutionError
from .selector_builder import ElementSelector


class ClickElementTool(Tool):
    """Clicks an element on the webpage using its ID."""
    
    def __init__(self):
        super().__init__("click_element")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        ElementSelector.validate_element_id(args.get("element_id"))
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            element_id = ElementSelector.validate_element_id(args.get("element_id"))
            selector = ElementSelector.build_selector(element_id)
            
            await page.click(selector)
            await page.wait_for_timeout(2000)
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully clicked ID {element_id}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "CLICK_FAILED",
                f"Failed to click element: {str(e)}"
            )


class TypeTextTool(Tool):
    """Types text into an input field using its ID."""
    
    def __init__(self):
        super().__init__("type_text")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        ElementSelector.validate_element_id(args.get("element_id"))
        text = args.get("text")
        if not isinstance(text, str):
            raise ValueError("text must be a string")
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            element_id = ElementSelector.validate_element_id(args.get("element_id"))
            text = args.get("text", "")
            selector = ElementSelector.build_selector(element_id)
            
            await page.fill(selector, text)
            await asyncio.sleep(0.5)
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully typed '{text}' into ID {element_id}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "TYPING_FAILED",
                f"Failed to type text: {str(e)}"
            )


class GotoUrlTool(Tool):
    """Navigates the browser to a specific URL."""
    
    def __init__(self):
        super().__init__("goto_url")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        url = args.get("url")
        if not isinstance(url, str) or not url.strip():
            raise ValueError("url must be a non-empty string")
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            url = args.get("url", "").strip()
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully navigated to {url}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "NAVIGATION_FAILED",
                f"Failed to navigate to URL: {str(e)}"
            )


class FinishTaskTool(Tool):
    """Call this tool when the user's intent has been successfully completed."""
    
    def __init__(self):
        super().__init__("finish_task")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        msg = args.get("final_message")
        if not isinstance(msg, str) or not msg.strip():
            raise ValueError("final_message must be a non-empty string")
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        msg = args.get("final_message", "").strip()
        return ToolExecutionResult(
            status="success",
            data=f"FINISHED: {msg}",
            metadata={"is_terminal": True}
        )


class PressKeyTool(Tool):
    """Simulates pressing a physical keyboard key on a specific element."""
    
    def __init__(self):
        super().__init__("press_key")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        ElementSelector.validate_element_id(args.get("element_id"))
        key = args.get("key")
        if not isinstance(key, str) or not key.strip():
            raise ValueError("key must be a non-empty string")
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            element_id = ElementSelector.validate_element_id(args.get("element_id"))
            key = args.get("key", "").strip()
            selector = ElementSelector.build_selector(element_id)
            
            await page.press(selector, key)
            if key.lower() == "enter":
                await page.wait_for_timeout(2000)
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully pressed '{key}' on ID {element_id}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "KEY_PRESS_FAILED",
                f"Failed to press key: {str(e)}"
            )


class ExtractTextTool(Tool):
    """Extracts the readable paragraph and heading text from the current webpage."""
    
    def __init__(self):
        super().__init__("extract_text")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
                "name": "extract_text",
                "description": "Extracts the readable paragraph and heading text from the current webpage. Use this when you need to read an article, find specific data, or summarize a page.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        # No validation needed for this tool
        pass
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            page_text = await page.locator("body").inner_text()
            # Clean up excessive whitespace
            page_text = re.sub(r"\n+", "\n", page_text).strip()
            
            # Truncate if too long
            clean_text = page_text[:4000]
            if len(page_text) > 4000:
                clean_text += "\n...[Text truncated for length]"
            
            return ToolExecutionResult(
                status="success",
                data=f"Page Text Content:\n\n{clean_text}"
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "EXTRACTION_FAILED",
                f"Failed to extract text: {str(e)}"
            )


class ScrollPageTool(Tool):
    """Scrolls the webpage."""
    
    VALID_DIRECTIONS = {"down", "up", "bottom", "top"}
    
    def __init__(self):
        super().__init__("scroll_page")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        direction = args.get("direction", "").lower()
        if direction not in self.VALID_DIRECTIONS:
            raise ValueError(f"direction must be one of {self.VALID_DIRECTIONS}, got '{direction}'")
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            direction = args.get("direction", "down").lower()
            
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
            else:  # down
                await page.evaluate(
                    "window.scrollBy({ top: window.innerHeight, left: 0, behavior: 'smooth' })"
                )
            
            await asyncio.sleep(1.5)
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully scrolled the page {direction}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "SCROLL_FAILED",
                f"Failed to scroll page: {str(e)}"
            )


class HoverElementTool(Tool):
    """Hovers the mouse cursor over an element using its ID."""
    
    def __init__(self):
        super().__init__("hover_element")
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(
            function={
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
            }
        )
    
    async def validate(self, args: Dict[str, Any]) -> None:
        ElementSelector.validate_element_id(args.get("element_id"))
    
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        try:
            element_id = ElementSelector.validate_element_id(args.get("element_id"))
            selector = ElementSelector.build_selector(element_id)
            
            await page.hover(selector)
            await asyncio.sleep(1.5)
            
            return ToolExecutionResult(
                status="success",
                data=f"Successfully hovered over ID {element_id}."
            )
        except Exception as e:
            raise ToolExecutionError(
                self.name,
                "HOVER_FAILED",
                f"Failed to hover over element: {str(e)}"
            )
