"""
Unit tests for tool registry and base tool classes.
"""
import pytest
from engine.tools.base import Tool, ToolRegistry, ToolExecutionError, ToolSchema, ToolExecutionResult


class SimpleTool(Tool):
    """Simple test tool for testing registry."""
    
    def get_schema(self) -> ToolSchema:
        return ToolSchema(function={"name": "simple", "description": "Simple test tool"})
    
    async def validate(self, args):
        if args.get("invalid"):
            raise ValueError("Invalid argument")
    
    async def execute(self, args, page):
        return ToolExecutionResult(status="success", data="executed")


class TestToolRegistry:
    """Test tool registry functionality."""
    
    def test_singleton_pattern(self):
        """Registry should be a singleton."""
        registry1 = ToolRegistry()
        registry2 = ToolRegistry()
        assert registry1 is registry2
    
    def test_register_tool(self):
        """Should register tools successfully."""
        registry = ToolRegistry()
        registry.clear()
        
        tool = SimpleTool("test")
        registry.register(tool)
        
        assert registry.get("test") is tool
    
    def test_register_duplicate_fails(self):
        """Should not allow duplicate tool registration."""
        registry = ToolRegistry()
        registry.clear()
        
        tool1 = SimpleTool("duplicate")
        tool2 = SimpleTool("duplicate")
        
        registry.register(tool1)
        
        with pytest.raises(ValueError, match="already registered"):
            registry.register(tool2)
    
    def test_get_nonexistent_tool_fails(self):
        """Should raise error when getting unregistered tool."""
        registry = ToolRegistry()
        registry.clear()
        
        with pytest.raises(ValueError, match="not found in registry"):
            registry.get("nonexistent")
    
    def test_get_all_tools(self):
        """Should return all registered tools."""
        registry = ToolRegistry()
        registry.clear()
        
        tool1 = SimpleTool("tool1")
        tool2 = SimpleTool("tool2")
        
        registry.register(tool1)
        registry.register(tool2)
        
        tools = registry.get_all_tools()
        assert len(tools) == 2
        assert tool1 in tools
        assert tool2 in tools
    
    def test_get_all_schemas(self):
        """Should return schemas for all tools."""
        registry = ToolRegistry()
        registry.clear()
        
        tool = SimpleTool("test")
        registry.register(tool)
        
        schemas = registry.get_all_schemas()
        assert len(schemas) == 1
        assert schemas[0]["function"]["name"] == "test"
    
    @pytest.mark.asyncio
    async def test_execute_tool(self, mock_page):
        """Should execute tool through registry."""
        registry = ToolRegistry()
        registry.clear()
        
        tool = SimpleTool("test")
        registry.register(tool)
        
        result = await registry.execute_tool("test", {}, mock_page)
        
        assert result.status == "success"
        assert result.data == "executed"
    
    @pytest.mark.asyncio
    async def test_execute_nonexistent_tool_fails(self, mock_page):
        """Should fail when executing nonexistent tool."""
        registry = ToolRegistry()
        registry.clear()
        
        with pytest.raises(ToolExecutionError, match="not found"):
            await registry.execute_tool("nonexistent", {}, mock_page)
    
    @pytest.mark.asyncio
    async def test_validation_error_caught(self, mock_page):
        """Should catch validation errors from tools."""
        registry = ToolRegistry()
        registry.clear()
        
        tool = SimpleTool("test")
        registry.register(tool)
        
        with pytest.raises(ToolExecutionError, match="VALIDATION_ERROR"):
            await registry.execute_tool("test", {"invalid": True}, mock_page)
    
    def test_clear_registry(self):
        """Should clear all tools."""
        registry = ToolRegistry()
        registry.clear()
        
        tool = SimpleTool("test")
        registry.register(tool)
        
        registry.clear()
        
        with pytest.raises(ValueError):
            registry.get("test")


class TestToolExecutionError:
    """Test custom error handling."""
    
    def test_tool_execution_error_message(self):
        """Should format error message correctly."""
        error = ToolExecutionError("click", "SELECTOR_NOT_FOUND", "Element not found", "Try scrolling first")
        
        assert error.tool_name == "click"
        assert error.error_code == "SELECTOR_NOT_FOUND"
        assert error.message == "Element not found"
        assert error.retry_hint == "Try scrolling first"
        assert "click:SELECTOR_NOT_FOUND" in str(error)
    
    def test_error_without_retry_hint(self):
        """Should handle errors without retry hint."""
        error = ToolExecutionError("click", "UNKNOWN", "Unknown error")
        
        assert error.retry_hint is None
        assert "[click:UNKNOWN]" in str(error)


class TestToolExecutionResult:
    """Test result data structures."""
    
    def test_create_success_result(self):
        """Should create success result."""
        result = ToolExecutionResult(status="success", data="test data")
        
        assert result.status == "success"
        assert result.data == "test data"
        assert result.error is None
        assert result.metadata == {}
    
    def test_create_error_result(self):
        """Should create error result with metadata."""
        result = ToolExecutionResult(
            status="failed",
            error="Something went wrong",
            metadata={"retry_count": 3}
        )
        
        assert result.status == "failed"
        assert result.error == "Something went wrong"
        assert result.metadata["retry_count"] == 3
