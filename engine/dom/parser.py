"""
DOM parsing utilities for converting raw DOM JSON to structured models.
"""
import json
from typing import List, Optional
from models.script import DOMElement


def parse_dom_state(dom_string: str) -> List[DOMElement]:
    """
    Convert raw DOM JSON string into structured DOMElement objects.
    
    Args:
        dom_string: JSON string containing array of DOM element objects
        
    Returns:
        List of DOMElement Pydantic models
        
    Raises:
        ValueError: If JSON is invalid or contains unexpected structure
        json.JSONDecodeError: If JSON parsing fails
    """
    try:
        raw_elements = json.loads(dom_string)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse DOM JSON: {str(e)}")
    
    if not isinstance(raw_elements, list):
        raise ValueError(f"Expected DOM to be a list, got {type(raw_elements).__name__}")
    
    dom_elements = []
    for idx, elem in enumerate(raw_elements):
        try:
            dom_elem = DOMElement(
                element_id=elem.get("element_id", idx),
                element_type=elem.get("element_type", "unknown"),
                text=elem.get("text", ""),
                href=elem.get("href")
            )
            dom_elements.append(dom_elem)
        except Exception as e:
            # Log and skip malformed elements
            print(f"Warning: Failed to parse DOM element at index {idx}: {str(e)}")
            continue
    
    return dom_elements


def merge_dom_states(old_dom: List[DOMElement], new_dom: List[DOMElement]) -> List[DOMElement]:
    """
    Merge two DOM states, preferring new elements but preserving IDs where possible.
    
    Args:
        old_dom: Previously extracted DOM state
        new_dom: Newly extracted DOM state
        
    Returns:
        Merged DOM list
    """
    # If old DOM is empty, return new
    if not old_dom:
        return new_dom
    
    # Build a map of old elements by position for ID preservation
    old_by_text = {elem.text[:50]: elem.element_id for elem in old_dom if elem.text}
    
    # Preserve IDs from old DOM where text matches
    for elem in new_dom:
        key = elem.text[:50]
        if key in old_by_text:
            elem.element_id = old_by_text[key]
    
    return new_dom
