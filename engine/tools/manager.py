"""
Tool manager - registry initialization and convenience functions.
"""
import json
from .base import ToolRegistry, ToolExecutionError
from .tools import (
    ClickElementTool,
    TypeTextTool,
    GotoUrlTool,
    FinishTaskTool,
    PressKeyTool,
    ExtractTextTool,
    ScrollPageTool,
    HoverElementTool,
)


def initialize_registry() -> ToolRegistry:
    """Initialize and populate the tool registry with all available tools."""
    registry = ToolRegistry()
    
    # Clear any existing tools (for test isolation)
    registry.clear()
    
    # Register all tools
    registry.register(ClickElementTool())
    registry.register(TypeTextTool())
    registry.register(GotoUrlTool())
    registry.register(FinishTaskTool())
    registry.register(PressKeyTool())
    registry.register(ExtractTextTool())
    registry.register(ScrollPageTool())
    registry.register(HoverElementTool())
    
    return registry


# Get singleton instance
_registry = initialize_registry()

# Convenience exports
AGENT_TOOLS = _registry.get_all_schemas()


async def execute_tool(tool_call, page):
    """
    Executes a tool by delegating to the tool registry.
    Converts result to string format for backward compatibility.
    """
    func_name = tool_call.function.name
    
    # Parse arguments
    try:
        args_string = tool_call.function.arguments
        args = {}
        if args_string:
            if isinstance(args_string, str):
                args = json.loads(args_string)
            elif isinstance(args_string, dict):
                args = args_string
    except Exception:
        args = {}
    
    try:
        result = await _registry.execute_tool(func_name, args, page)
        # Return string format for backward compatibility
        return result.data if result.data else f"Successfully executed {func_name}"
    except ToolExecutionError as e:
        # Return error message in backward-compatible string format
        return f"[ERROR:{e.error_code}] {e.message}"
    except Exception as e:
        return f"[ERROR:UNKNOWN] Failed to execute {func_name}: {str(e)}"

