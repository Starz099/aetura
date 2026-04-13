"""
DOM extraction and parsing module.
"""
from .strategy import DOMStrategy, DOMExtractorV1
from .parser import parse_dom_state, merge_dom_states

__all__ = [
    "DOMStrategy",
    "DOMExtractorV1",
    "parse_dom_state",
    "merge_dom_states",
]
