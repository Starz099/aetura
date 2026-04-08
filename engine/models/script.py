from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class DOMElement(BaseModel):
    """Represents a single clickable/typable element on the webpage."""

    element_id: int
    element_type: str
    text: str
    href: Optional[str] = None


class Action(BaseModel):
    """Represents the tool the AI decided to use."""

    tool_name: str
    arguments: Dict[str, Any]
    description: str = Field(
        description="A human-readable explanation of what the AI did."
    )


class Step(BaseModel):
    """Represents one complete action cycle in the timeline."""

    step_number: int
    current_url: str
    action_taken: Action
    available_elements: List[DOMElement]


class DemoScript(BaseModel):
    """The final payload sent to the React frontend."""

    goal: str
    starting_url: str
    steps: List[Step]
