"""
Unit tests for individual tool implementations.
"""
import pytest
from engine.tools.tools import (
    ClickElementTool,
    TypeTextTool,
    GotoUrlTool,
    FinishTaskTool,
    PressKeyTool,
    ExtractTextTool,
    ScrollPageTool,
    HoverElementTool,
)
from engine.tools.base import ToolExecutionError


class TestClickElementTool:
    """Test click element tool."""
    
    def test_schema(self):
        """Should return proper schema."""
        tool = ClickElementTool()
        schema = tool.get_schema()
        
        assert schema.function["name"] == "click_element"
        assert "element_id" in schema.function["parameters"]["properties"]
    
    @pytest.mark.asyncio
    async def test_validate_valid_element_id(self):
        """Should validate valid element ID."""
        tool = ClickElementTool()
        await tool.validate({"element_id": 123})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_validate_missing_element_id(self):
        """Should reject missing element ID."""
        tool = ClickElementTool()
        
        with pytest.raises(ValueError, match="element_id"):
            await tool.validate({})
    
    @pytest.mark.asyncio
    async def test_execute_success(self, mock_page):
        """Should execute click successfully."""
        tool = ClickElementTool()
        result = await tool.execute({"element_id": 1}, mock_page)
        
        assert result.status == "success"
        assert "clicked" in result.data.lower()
        mock_page.click.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_handles_errors(self, mock_page):
        """Should handle click errors."""
        mock_page.click.side_effect = Exception("Click failed")
        tool = ClickElementTool()
        
        with pytest.raises(ToolExecutionError, match="CLICK_FAILED"):
            await tool.execute({"element_id": 1}, mock_page)


class TestTypeTextTool:
    """Test type text tool."""
    
    def test_schema(self):
        """Should return proper schema."""
        tool = TypeTextTool()
        schema = tool.get_schema()
        
        assert schema.function["name"] == "type_text"
        assert "element_id" in schema.function["parameters"]["properties"]
        assert "text" in schema.function["parameters"]["properties"]
    
    @pytest.mark.asyncio
    async def test_validate_valid_args(self):
        """Should validate valid arguments."""
        tool = TypeTextTool()
        await tool.validate({"element_id": 123, "text": "hello"})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_validate_missing_text(self):
        """Should reject missing text."""
        tool = TypeTextTool()
        
        with pytest.raises(ValueError):
            await tool.validate({"element_id": 123})
    
    @pytest.mark.asyncio
    async def test_execute_success(self, mock_page):
        """Should execute type text successfully."""
        tool = TypeTextTool()
        result = await tool.execute({"element_id": 1, "text": "test"}, mock_page)
        
        assert result.status == "success"
        assert "typed" in result.data.lower()
        mock_page.fill.assert_called_once()


class TestGotoUrlTool:
    """Test goto URL tool."""
    
    @pytest.mark.asyncio
    async def test_validate_valid_url(self):
        """Should validate valid URL."""
        tool = GotoUrlTool()
        await tool.validate({"url": "https://example.com"})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_validate_empty_url(self):
        """Should reject empty URL."""
        tool = GotoUrlTool()
        
        with pytest.raises(ValueError, match="non-empty"):
            await tool.validate({"url": ""})
    
    @pytest.mark.asyncio
    async def test_execute_success(self, mock_page):
        """Should navigate successfully."""
        tool = GotoUrlTool()
        result = await tool.execute({"url": "https://example.com"}, mock_page)
        
        assert result.status == "success"
        mock_page.goto.assert_called_once_with("https://example.com")


class TestFinishTaskTool:
    """Test finish task tool."""
    
    @pytest.mark.asyncio
    async def test_validate_valid_message(self):
        """Should validate valid message."""
        tool = FinishTaskTool()
        await tool.validate({"final_message": "Done!"})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_validate_empty_message(self):
        """Should reject empty message."""
        tool = FinishTaskTool()
        
        with pytest.raises(ValueError, match="non-empty"):
            await tool.validate({"final_message": ""})
    
    @pytest.mark.asyncio
    async def test_execute_returns_terminal_status(self, mock_page):
        """Should mark task as finished."""
        tool = FinishTaskTool()
        result = await tool.execute({"final_message": "Task completed!"}, mock_page)
        
        assert result.status == "success"
        assert "FINISHED:" in result.data
        assert result.metadata["is_terminal"] is True


class TestPressKeyTool:
    """Test press key tool."""
    
    @pytest.mark.asyncio
    async def test_validate_valid_args(self):
        """Should validate valid arguments."""
        tool = PressKeyTool()
        await tool.validate({"element_id": 1, "key": "Enter"})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_execute_success(self, mock_page):
        """Should press key successfully."""
        tool = PressKeyTool()
        result = await tool.execute({"element_id": 1, "key": "Enter"}, mock_page)
        
        assert result.status == "success"
        mock_page.press.assert_called_once()


class TestExtractTextTool:
    """Test extract text tool."""
    
    @pytest.mark.asyncio
    async def test_execute_extracts_text(self, mock_page):
        """Should extract page text."""
        tool = ExtractTextTool()
        result = await tool.execute({}, mock_page)
        
        assert result.status == "success"
        assert "Page Text Content" in result.data
        mock_page.locator.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_truncates_long_text(self, mock_page):
        """Should truncate very long text."""
        long_text = "x" * 10000
        mock_page.locator.return_value.inner_text = type('AsyncMock', (), {'__call__': lambda *a, **k: long_text})()
        
        tool = ExtractTextTool()
        # Mock the async call properly
        async def mock_inner_text():
            return long_text
        mock_page.locator.return_value.inner_text = mock_inner_text
        
        result = await tool.execute({}, mock_page)
        
        assert "[Text truncated" in result.data


class TestScrollPageTool:
    """Test scroll page tool."""
    
    @pytest.mark.asyncio
    async def test_validate_valid_direction(self):
        """Should validate valid directions."""
        tool = ScrollPageTool()
        
        for direction in ["down", "up", "top", "bottom"]:
            await tool.validate({"direction": direction})  # Should not raise
    
    @pytest.mark.asyncio
    async def test_validate_invalid_direction(self):
        """Should reject invalid direction."""
        tool = ScrollPageTool()
        
        with pytest.raises(ValueError, match="direction must be one of"):
            await tool.validate({"direction": "sideways"})
    
    @pytest.mark.asyncio
    async def test_execute_scrolls(self, mock_page):
        """Should scroll page."""
        tool = ScrollPageTool()
        result = await tool.execute({"direction": "down"}, mock_page)
        
        assert result.status == "success"
        mock_page.evaluate.assert_called_once()


class TestHoverElementTool:
    """Test hover element tool."""
    
    @pytest.mark.asyncio
    async def test_execute_hovers(self, mock_page):
        """Should hover over element."""
        tool = HoverElementTool()
        result = await tool.execute({"element_id": 1}, mock_page)
        
        assert result.status == "success"
        mock_page.hover.assert_called_once()
