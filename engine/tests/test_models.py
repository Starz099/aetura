"""
Unit tests for data models.
"""
from engine.models.script import (
    ToolResult,
    ToolResultStatus,
    ToolExecutionError,
    DOMElement,
    Action,
    Step,
    DemoScript,
)


class TestToolResult:
    """Test ToolResult model."""
    
    def test_create_success_result(self):
        """Should create success result."""
        result = ToolResult(
            status=ToolResultStatus.SUCCESS,
            data="test data"
        )
        
        assert result.is_success() is True
        assert result.is_retriable() is False
        assert result.error is None
    
    def test_create_failed_result(self):
        """Should create failed result."""
        result = ToolResult(
            status=ToolResultStatus.FAILED,
            error="Something failed",
            error_code="EXECUTION_ERROR",
            metadata={"retry_count": 2}
        )
        
        assert result.is_success() is False
        assert result.is_retriable() is False
        assert result.error == "Something failed"
    
    def test_retriable_status(self):
        """Should correctly identify retriable statuses."""
        retry_result = ToolResult(status=ToolResultStatus.RETRY)
        partial_result = ToolResult(status=ToolResultStatus.PARTIAL)
        success_result = ToolResult(status=ToolResultStatus.SUCCESS)
        
        assert retry_result.is_retriable() is True
        assert partial_result.is_retriable() is True
        assert success_result.is_retriable() is False
    
    def test_metadata_handling(self):
        """Should handle metadata dict."""
        result = ToolResult(
            status=ToolResultStatus.SUCCESS,
            metadata={"steps": 3, "duration_ms": 1500}
        )
        
        assert result.metadata["steps"] == 3
        assert result.metadata["duration_ms"] == 1500


class TestToolExecutionError:
    """Test ToolExecutionError model."""
    
    def test_create_error(self):
        """Should create error model."""
        error = ToolExecutionError(
            tool_name="click_element",
            error_code="SELECTOR_NOT_FOUND",
            message="Element not found with selector",
            retry_hint="Try scrolling to make element visible"
        )
        
        assert error.tool_name == "click_element"
        assert error.error_code == "SELECTOR_NOT_FOUND"
        assert error.retry_hint is not None
    
    def test_error_without_retry_hint(self):
        """Should create error without retry hint."""
        error = ToolExecutionError(
            tool_name="goto_url",
            error_code="NAVIGATION_FAILED",
            message="Failed to navigate to URL"
        )
        
        assert error.retry_hint is None


class TestDOMElement:
    """Test DOMElement model."""
    
    def test_create_element(self):
        """Should create DOM element."""
        elem = DOMElement(
            element_id=1,
            element_type="button",
            text="Click me",
            href=None
        )
        
        assert elem.element_id == 1
        assert elem.element_type == "button"
        assert elem.text == "Click me"
    
    def test_element_with_href(self):
        """Should store href for links."""
        elem = DOMElement(
            element_id=2,
            element_type="a",
            text="Link",
            href="https://example.com"
        )
        
        assert elem.href == "https://example.com"


class TestAction:
    """Test Action model."""
    
    def test_create_action(self):
        """Should create action."""
        action = Action(
            tool_name="click_element",
            arguments={"element_id": 1},
            description="Clicked the submit button"
        )
        
        assert action.tool_name == "click_element"
        assert action.arguments["element_id"] == 1


class TestStep:
    """Test Step model."""
    
    def test_create_step(self):
        """Should create step."""
        action = Action(
            tool_name="click_element",
            arguments={"element_id": 1},
            description="Clicked"
        )
        
        step = Step(
            step_number=1,
            current_url="https://example.com",
            action_taken=action,
            available_elements=[]
        )
        
        assert step.step_number == 1
        assert step.current_url == "https://example.com"


class TestDemoScript:
    """Test DemoScript model."""
    
    def test_create_demo_script(self):
        """Should create demo script."""
        script = DemoScript(
            goal="Find product",
            starting_url="https://example.com",
            steps=[]
        )
        
        assert script.goal == "Find product"
        assert len(script.steps) == 0
