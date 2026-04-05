DOM_EXTRACTOR_JS = """
() => {
    let elements = document.querySelectorAll('input, button, a, textarea, [role="button"]');
    let result = [];
    let idCounter = 1;
    
    elements.forEach(el => {
        let rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none') {
            
            el.setAttribute('data-aetura-id', idCounter);
            
            let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.name || el.title || 'Unknown';
            text = text.trim().replace(/\\n/g, ' ').substring(0, 60); 
            
            let elementType = el.tagName.toLowerCase();
            if (elementType === 'input') {
                elementType += `[type="${el.type || 'text'}"]`;
            }
            
            // 🚨 NEW: Give the AI X-Ray vision into where links go! 🚨
            let extraInfo = '';
            if (elementType === 'a' && el.hasAttribute('href')) {
                extraInfo = ` [href="${el.getAttribute('href')}"]`;
            }
            
            if (text !== 'Unknown' && text !== '') {
                result.push(`[ID: ${idCounter}] ${elementType}${extraInfo} - "${text}"`);
                idCounter++;
            }
        }
    });
    return result.join('\\n');
}
"""


async def extract_clean_dom(page):
    """Executes the JS in Playwright and returns the clean text string."""
    print("👁️ Extracting interactive elements from the page...")
    return await page.evaluate(DOM_EXTRACTOR_JS)
