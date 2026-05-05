from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class ToolResultStatus(str, Enum):
    """Status of tool execution result."""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    RETRY = "retry"


class ToolResult(BaseModel):
    """Standardized result from tool execution."""
    status: ToolResultStatus
    data: Any = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    def is_success(self) -> bool:
        """Check if tool execution was successful."""
        return self.status == ToolResultStatus.SUCCESS
    
    def is_retriable(self) -> bool:
        """Check if tool execution can be retried."""
        return self.status in (ToolResultStatus.RETRY, ToolResultStatus.PARTIAL)


class ToolExecutionError(BaseModel):
    """Error information from tool execution."""
    tool_name: str
    error_code: str
    message: str
    retry_hint: Optional[str] = None


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


class BoundingBox(BaseModel):
    """Represents the position and size of an element."""
    x: float
    y: float
    width: float
    height: float


class Step(BaseModel):
    """Represents one complete action cycle in the timeline."""

    step_number: int
    current_url: str
    action_taken: Action
    available_elements: List[DOMElement]
    timestamp: float = Field(
        default=0.0, 
        description="Timestamp in seconds from the start of the recording."
    )
    element_rect: Optional[BoundingBox] = Field(
        default=None,
        description="Bounding box of the element involved in the action."
    )


class DemoScript(BaseModel):
    """The final payload sent to the React frontend."""

    goal: str
    starting_url: str
    steps: List[Step]

class ZoomAnchor(BaseModel):
    """Represents the anchor point for a zoom effect."""
    x: float
    y: float


class ZoomEffect(BaseModel):
    """Represents a zoom effect in the timeline."""
    id: str
    startTime: float
    duration: float
    multiplier: float
    anchor: ZoomAnchor


class BackgroundSettings(BaseModel):
    """Represents background aesthetic settings."""
    enabled: bool
    presetId: str
    padding: int = 60
    roundedness: int = 12


class EditorManifest(BaseModel):
    """The complete declarative edit state for the video."""
    effects: List[ZoomEffect]
    background: BackgroundSettings