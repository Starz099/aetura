"""
Pytest configuration and fixtures for engine tests.
"""
import asyncio
import inspect
import sys
from pathlib import Path

import pytest
from unittest.mock import AsyncMock, MagicMock


# Make `engine.*` imports work whether pytest is run from repo root or engine/.
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def pytest_configure(config):
    """Register custom markers used by the test suite."""
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as async coroutine test",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_pyfunc_call(pyfuncitem):
    """Run async test functions without requiring external asyncio plugins."""
    if not inspect.iscoroutinefunction(pyfuncitem.obj):
        return None

    funcargs = {
        arg: pyfuncitem.funcargs[arg]
        for arg in pyfuncitem._fixtureinfo.argnames
    }
    asyncio.run(pyfuncitem.obj(**funcargs))
    return True


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
