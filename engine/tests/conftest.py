"""
Pytest configuration and fixtures for engine tests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_page():
    """Create a mock Playwright page object."""
    page = AsyncMock()
    page.click = AsyncMock()
    page.wait_for_timeout = AsyncMock()
    page.fill = AsyncMock()
    page.press = AsyncMock()
    page.goto = AsyncMock()
    page.wait_for_load_state = AsyncMock()
    page.locator = MagicMock()
    page.locator.return_value.inner_text = AsyncMock(return_value="Test page content")
    page.hover = AsyncMock()
    page.evaluate = AsyncMock()
    page.wait_for_timeout = AsyncMock()
    return page
