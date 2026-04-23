"""
Base Tool abstraction and Tool Registry for extensible tool system.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
import json


@dataclass
class ToolSchema:
    """OpenAI-compatible tool schema definition."""
    type: str = "function"
    function: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "function": self.function
        }


@dataclass
class ToolExecutionResult:
    """Standardized result from tool execution."""
    status: str  # "success", "partial", "failed", "retry"
    data: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class ToolExecutionError(Exception):
    """Custom exception for tool execution failures."""
    def __init__(self, tool_name: str, error_code: str, message: str, retry_hint: Optional[str] = None):
        self.tool_name = tool_name
        self.error_code = error_code
        self.message = message
        self.retry_hint = retry_hint
        super().__init__(f"[{tool_name}:{error_code}] {message}")


class Tool(ABC):
    """Abstract base class for all tools."""
    
    def __init__(self, name: str):
        self.name = name
    
    @abstractmethod
    def get_schema(self) -> ToolSchema:
        """Return OpenAI-compatible tool schema."""
        pass
    
    @abstractmethod
    async def validate(self, args: Dict[str, Any]) -> None:
        """Validate tool arguments. Raise ToolExecutionError if invalid."""
        pass
    
    @abstractmethod
    async def execute(self, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        """Execute the tool. Return standardized result."""
        pass


class ToolRegistry:
    """Registry for managing tool registration and execution."""
    
    _instance = None
    _tools: Dict[str, Tool] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def register(self, tool: Tool) -> None:
        """Register a tool."""
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered")
        self._tools[tool.name] = tool
    
    def get(self, tool_name: str) -> Tool:
        """Get a registered tool by name."""
        if tool_name not in self._tools:
            raise ValueError(f"Tool '{tool_name}' not found in registry")
        return self._tools[tool_name]
    
    def get_all_tools(self) -> List[Tool]:
        """Get all registered tools."""
        return list(self._tools.values())
    
    def get_all_schemas(self) -> List[Dict[str, Any]]:
        """Get OpenAI-compatible schemas for all registered tools."""
        schemas: List[Dict[str, Any]] = []
        for tool in self.get_all_tools():
            schema = tool.get_schema().to_dict()
            function_schema = schema.get("function")
            if isinstance(function_schema, dict):
                function_schema["name"] = tool.name
            schemas.append(schema)
        return schemas
    
    async def execute_tool(self, tool_name: str, args: Dict[str, Any], page: Any) -> ToolExecutionResult:
        """Execute a tool by name with given arguments."""
        if tool_name not in self._tools:
            raise ToolExecutionError(tool_name, "NOT_FOUND", f"Tool '{tool_name}' not found")
        
        tool = self._tools[tool_name]
        
        try:
            await tool.validate(args)
        except ToolExecutionError:
            raise
        except Exception as e:
            raise ToolExecutionError(tool_name, "VALIDATION_ERROR", str(e))
        
        try:
            return await tool.execute(args, page)
        except ToolExecutionError:
            raise
        except Exception as e:
            raise ToolExecutionError(tool_name, "EXECUTION_ERROR", str(e))
    
    def clear(self) -> None:
        """Clear all registered tools (useful for testing)."""
        self._tools.clear()
