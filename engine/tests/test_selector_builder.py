"""
Unit tests for element selector builder.
"""
import pytest
from engine.tools.selector_builder import ElementSelector


class TestElementSelector:
    """Test element selector utilities."""
    
    def test_build_selector_valid_id(self):
        """Should build valid selector for valid ID."""
        selector = ElementSelector.build_selector(123)
        
        assert selector == "[data-aetura-id='123']"
    
    def test_build_selector_zero_id(self):
        """Should build selector for zero ID."""
        selector = ElementSelector.build_selector(0)
        
        assert selector == "[data-aetura-id='0']"
    
    def test_build_selector_negative_id_fails(self):
        """Should reject negative IDs."""
        with pytest.raises(ValueError, match="non-negative"):
            ElementSelector.build_selector(-1)
    
    def test_build_selector_non_int_fails(self):
        """Should reject non-integer IDs."""
        with pytest.raises(ValueError, match="Invalid element_id"):
            ElementSelector.build_selector("123")
    
    def test_validate_element_id_valid(self):
        """Should validate valid element ID."""
        result = ElementSelector.validate_element_id(123)
        
        assert result == 123
    
    def test_validate_element_id_none_fails(self):
        """Should reject None."""
        with pytest.raises(ValueError, match="required but not provided"):
            ElementSelector.validate_element_id(None)
    
    def test_validate_element_id_string_fails(self):
        """Should reject string ID."""
        with pytest.raises(ValueError, match="must be an integer"):
            ElementSelector.validate_element_id("123")
    
    def test_validate_element_id_negative_fails(self):
        """Should reject negative ID."""
        with pytest.raises(ValueError, match="non-negative"):
            ElementSelector.validate_element_id(-1)
    
    def test_element_id_attr_constant(self):
        """Should have correct attribute name."""
        assert ElementSelector.ELEMENT_ID_ATTR == "data-aetura-id"
