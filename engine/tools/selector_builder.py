"""
Centralized element selector construction and validation.
"""
from typing import Optional


class ElementSelector:
    """Utility for building consistent element selectors."""
    
    # Data attribute used for element identification across the system
    ELEMENT_ID_ATTR = "data-aetura-id"
    
    @staticmethod
    def build_selector(element_id: int) -> str:
        """Build a selector for an element by its aetura ID."""
        if not isinstance(element_id, int):
            raise ValueError(f"Invalid element_id: {element_id}")
        if element_id < 0:
            raise ValueError(f"element_id must be non-negative, got {element_id}")
        return f"[{ElementSelector.ELEMENT_ID_ATTR}='{element_id}']"
    
    @staticmethod
    def validate_element_id(element_id: Optional[int]) -> int:
        """Validate and return element ID, raising exception if invalid."""
        if element_id is None:
            raise ValueError("element_id is required but not provided")
        if not isinstance(element_id, int):
            raise ValueError(f"element_id must be an integer, got {type(element_id).__name__}")
        if element_id < 0:
            raise ValueError(f"element_id must be non-negative, got {element_id}")
        return element_id
