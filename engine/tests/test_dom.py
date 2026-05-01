"""
Unit tests for DOM extraction strategy and parsing.
"""
import pytest
import json
from unittest.mock import AsyncMock
from engine.dom.strategy import DOMExtractorV1
from engine.dom.parser import parse_dom_state, merge_dom_states
from engine.models.script import DOMElement


class TestDOMExtractorV1:
    """Test DOM extractor V1 implementation."""
    
    def test_version(self):
        """Should report correct version."""
        extractor = DOMExtractorV1()
        assert extractor.version == "1.0"
    
    def test_javascript_property(self):
        """Should provide extraction JavaScript."""
        extractor = DOMExtractorV1()
        js = extractor.extractor_javascript
        
        assert isinstance(js, str)
        assert len(js) > 0
        assert "extractElementsOptimized" in js
    
    @pytest.mark.asyncio
    async def test_extract_from_page(self, mock_page):
        """Should extract DOM from page."""
        extractor = DOMExtractorV1()
        
        # Mock page.evaluate to return valid JSON
        dom_json = json.dumps([
            {"element_id": 0, "element_type": "button", "text": "Click me", "href": None},
            {"element_id": 1, "element_type": "input", "text": "", "href": None}
        ])
        mock_page.evaluate = AsyncMock(return_value=dom_json)

        result = await extractor.extract(mock_page)

        assert result == dom_json
        mock_page.evaluate.assert_called_once_with(extractor.extractor_javascript)


class TestParseDOMState:
    """Test DOM state parsing."""
    
    def test_parse_valid_dom(self):
        """Should parse valid DOM JSON."""
        dom_json = json.dumps([
            {"element_id": 0, "element_type": "button", "text": "Click", "href": None},
            {"element_id": 1, "element_type": "a", "text": "Link", "href": "http://example.com"}
        ])
        
        elements = parse_dom_state(dom_json)
        
        assert len(elements) == 2
        assert elements[0].element_type == "button"
        assert elements[1].href == "http://example.com"
    
    def test_parse_invalid_json_fails(self):
        """Should raise error for invalid JSON."""
        with pytest.raises(ValueError, match="Failed to parse DOM JSON"):
            parse_dom_state("not valid json")
    
    def test_parse_non_list_fails(self):
        """Should raise error if DOM is not a list."""
        with pytest.raises(ValueError, match="Expected DOM to be a list"):
            parse_dom_state('{"not": "a list"}')
    
    def test_parse_handles_missing_fields(self):
        """Should handle missing optional fields."""
        dom_json = json.dumps([
            {"element_id": 0, "element_type": "button"}
        ])
        
        elements = parse_dom_state(dom_json)
        
        assert elements[0].text == ""
        assert elements[0].href is None
    
    def test_parse_with_index_fallback(self):
        """Should use index if element_id missing."""
        dom_json = json.dumps([
            {"element_type": "button", "text": "Click"},
            {"element_type": "input", "text": "Type"}
        ])
        
        elements = parse_dom_state(dom_json)
        
        assert elements[0].element_id == 0
        assert elements[1].element_id == 1

    def test_parse_legacy_dom_lines(self):
        """Should parse the legacy human-readable DOM format."""
        dom_text = (
            '[ID: 1] button - "Submit"\n'
            '[ID: 2] a [href="/blog"] - "Blog"\n'
            '[ID: 3] input[type="text"] - "Search"'
        )

        elements = parse_dom_state(dom_text)

        assert len(elements) == 3
        assert elements[0].element_id == 1
        assert elements[0].element_type == "button"
        assert elements[1].href == "/blog"
        assert elements[2].element_type == 'input[type="text"]'

    def test_parse_empty_dom_returns_empty_list(self):
        """Should return an empty list for an empty DOM string."""
        assert parse_dom_state("") == []


class TestMergeDOMStates:
    """Test DOM state merging."""
    
    def test_merge_empty_old_returns_new(self):
        """Should return new DOM if old is empty."""
        new_dom = [
            DOMElement(element_id=0, element_type="button", text="Click", href=None)
        ]
        
        result = merge_dom_states([], new_dom)
        
        assert result == new_dom
    
    def test_merge_preserves_ids(self):
        """Should preserve element IDs when text matches."""
        old_dom = [
            DOMElement(element_id=99, element_type="button", text="Click Me", href=None)
        ]
        new_dom = [
            DOMElement(element_id=0, element_type="button", text="Click Me", href=None)
        ]
        
        result = merge_dom_states(old_dom, new_dom)
        
        assert result[0].element_id == 99
    
    def test_merge_handles_changed_elements(self):
        """Should handle elements that disappeared/changed."""
        old_dom = [
            DOMElement(element_id=10, element_type="button", text="Old", href=None)
        ]
        new_dom = [
            DOMElement(element_id=0, element_type="button", text="New", href=None)
        ]
        
        result = merge_dom_states(old_dom, new_dom)
        
        # New elements without matching text keep their IDs
        assert result[0].element_id == 0
