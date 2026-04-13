"""
DOM parsing utilities for converting raw DOM data to structured models.
"""
import json
import re
from typing import List

from models.script import DOMElement


LEGACY_DOM_LINE_RE = re.compile(
    r'^\[ID:\s*(?P<element_id>\d+)\]\s*'
    r'(?P<element_type>.+?)'
    r'(?:\s+\[href="(?P<href>[^"]*)"\])?'
    r'\s+-\s+"(?P<text>.*)"$'
)


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
    if not dom_string or not dom_string.strip():
        return []

    try:
        raw_elements = json.loads(dom_string)
    except json.JSONDecodeError as e:
        raw_elements = []

        for line in dom_string.splitlines():
            line = line.strip()
            if not line:
                continue

            match = LEGACY_DOM_LINE_RE.match(line)
            if not match:
                raise ValueError(f"Failed to parse DOM JSON: {str(e)}")

            raw_elements.append(
                {
                    "element_id": int(match.group("element_id")),
                    "element_type": match.group("element_type"),
                    "text": match.group("text"),
                    "href": match.group("href") or None,
                }
            )
    
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
