"""
DOM extraction strategy abstraction for pluggable DOM extraction implementations.
"""
from abc import ABC, abstractmethod
from typing import Any


class DOMStrategy(ABC):
    """Abstract base class for DOM extraction strategies."""
    
    @property
    @abstractmethod
    def version(self) -> str:
        """Return version string for this strategy."""
        pass
    
    @property
    @abstractmethod
    def extractor_javascript(self) -> str:
        """Return the JavaScript code for DOM extraction."""
        pass
    
    @abstractmethod
    async def extract(self, page: Any) -> str:
        """
        Extract DOM from page and return raw JSON string.
        
        Args:
            page: Playwright page object
            
        Returns:
            Raw JSON string containing DOM structure
        """
        pass


class DOMExtractorV1(DOMStrategy):
    """Version 1 DOM extraction strategy (original implementation)."""
    
    # JavaScript to extract interactive elements from the page
    # This is the same JavaScript that was originally in tools/dom_extractor.py
    EXTRACTOR_JS = """
    function extractElementsOptimized() {
        const elementsSet = new Set();
        
        // Get interactive elements
        const interactiveSelectors = [
            'button', 'input', 'a', 'textarea', 'select',
            '[role="button"]', '[onclick]'
        ];
        
        interactiveSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    elementsSet.add(el);
                }
            });
        });
        
        // Convert to list with IDs
        const elements = [];
        elementsSet.forEach((el, idx) => {
            if (!el.getAttribute('data-aetura-id')) {
                el.setAttribute('data-aetura-id', idx.toString());
            }
            
            const id = el.getAttribute('data-aetura-id');
            const text = el.innerText?.substring(0, 100) || '';
            const href = el.href || null;
            
            elements.push({
                element_id: parseInt(id),
                element_type: el.tagName.toLowerCase(),
                text: text.trim(),
                href: href
            });
        });
        
        return JSON.stringify(elements);
    }
    
    return extractElementsOptimized();
    """
    
    @property
    def version(self) -> str:
        return "1.0"
    
    @property
    def extractor_javascript(self) -> str:
        return self.EXTRACTOR_JS
    
    async def extract(self, page: Any) -> str:
        """Extract DOM using Playwright evaluate."""
        return await page.evaluate(self.extractor_javascript)
