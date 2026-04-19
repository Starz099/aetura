"""Mock tool call objects used while replaying approved steps."""

import json
from typing import Any, Dict


class MockFunction:
    """Mock tool function for creating tool call objects."""

    def __init__(self, name: str, arguments: Dict[str, Any]):
        self.name = name
        self.arguments = json.dumps(arguments)


class MockToolCall:
    """Mock tool call for replaying recorded actions."""

    def __init__(self, name: str, arguments: Dict[str, Any]):
        self.function = MockFunction(name, arguments)
