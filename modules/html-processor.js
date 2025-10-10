// HTML Processor Module
// Handles HTML page extraction and saving

// Save page as HTML
export async function saveAsHtml(options, dependencies) {
  const { saveBtn, showStatus, sanitizeFilename, savedCount } = dependencies;
  
  try {
    saveBtn.disabled = true;
    showStatus('Saving page as HTML...', 'info');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can access this page
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('file://')) {
      throw new Error('Cannot save this type of page. Please open a regular http:// or https:// web page.');
    }

    // Double-check permissions
    const hasPermission = await chrome.permissions.contains({
      origins: ['http://*/*', 'https://*/*']
    });
    
    if (!hasPermission) {
      throw new Error('Missing permissions. Please click "Grant Permission" button and reload the page.');
    }

    // Execute content script to get page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
      args: [options]
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract page content');
    }

    const pageData = results[0].result;
    let htmlContent = pageData.html;

    // Minify if requested
    if (options.minifyHtml) {
      htmlContent = minifyHtml(htmlContent);
    }

    // Create filename
    const filename = sanitizeFilename(pageData.title || 'page') + '.html';

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });

    // Update statistics
    const result = await chrome.storage.local.get(['savedCount']);
    const newCount = (result.savedCount || 0) + 1;
    await chrome.storage.local.set({ savedCount: newCount });
    savedCount.textContent = newCount;

    showStatus('✓ Page saved as HTML!', 'success');

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error('Error saving page:', error);
    showStatus('✗ Error: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// Extract page content (injected function)
export function extractPageContent(options) {
  const doc = document.cloneNode(true);
  
  // Get page title
  const title = document.title;
  
  // FIRST: Expand all collapsed/hidden accordion content
  // This is critical for e-learning platforms and accordion-based layouts
  
  // 1. Expand Bootstrap/generic accordions with .collapse class
  doc.querySelectorAll('.collapse, .accordion__body').forEach(elem => {
    elem.classList.remove('collapse');
    elem.classList.add('show', 'in'); // Bootstrap show states
    elem.removeAttribute('aria-hidden');
    elem.removeAttribute('hidden');
    elem.style.display = '';
    elem.style.visibility = 'visible';
    elem.style.height = 'auto';
  });
  
  // 2. Expand elements with aria-expanded="false"
  doc.querySelectorAll('[aria-expanded="false"]').forEach(elem => {
    elem.setAttribute('aria-expanded', 'true');
  });
  
  // 3. Expand <details> elements
  doc.querySelectorAll('details').forEach(elem => {
    elem.setAttribute('open', '');
  });
  
  // 4. Show all elements with aria-hidden="true"
  doc.querySelectorAll('[aria-hidden="true"]').forEach(elem => {
    elem.removeAttribute('aria-hidden');
    elem.style.display = '';
    elem.style.visibility = 'visible';
  });
  
  // 5. Show hidden divs and spans
  doc.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden], .hidden:not(script):not(style)').forEach(elem => {
    elem.removeAttribute('hidden');
    elem.classList.remove('hidden');
    elem.style.display = '';
    elem.style.visibility = 'visible';
  });
  
  console.log('Expanded all collapsed accordion and hidden content for HTML export');

  // Handle images
  if (options.includeImages) {
    const images = doc.querySelectorAll('img');
    images.forEach(img => {
      const originalImg = document.querySelector(`img[src="${img.src}"]`);
      if (originalImg && originalImg.complete) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = originalImg.naturalWidth;
          canvas.height = originalImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(originalImg, 0, 0);
          img.src = canvas.toDataURL();
        } catch (e) {
          // If canvas fails (CORS), keep original URL
          console.warn('Could not inline image:', e);
        }
      }
    });
  }

  // Handle styles
  if (options.includeStyles) {
    // Inline external stylesheets
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          // CORS issues with external stylesheets
          return '';
        }
      })
      .filter(css => css)
      .join('\n');

    if (styles) {
      const styleElement = doc.createElement('style');
      styleElement.textContent = styles;
      doc.head.appendChild(styleElement);
    }

    // Inline computed styles for important elements
    const elements = doc.querySelectorAll('body, div, p, h1, h2, h3, h4, h5, h6, span, a');
    elements.forEach((elem, index) => {
      const originalElem = document.querySelectorAll('body, div, p, h1, h2, h3, h4, h5, h6, span, a')[index];
      if (originalElem) {
        const computedStyle = window.getComputedStyle(originalElem);
        const importantStyles = [
          'color', 'background-color', 'font-size', 'font-weight', 
          'font-family', 'text-align', 'padding', 'margin', 'display'
        ];
        
        let inlineStyles = elem.getAttribute('style') || '';
        importantStyles.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'initial') {
            inlineStyles += `${prop}: ${value}; `;
          }
        });
        
        if (inlineStyles) {
          elem.setAttribute('style', inlineStyles);
        }
      }
    });
  }

  // Remove scripts for security (unless user wants to keep them)
  if (!options.includeScripts) {
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());
  }

  // Get full HTML
  const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

  return { html, title };
}

// Simple HTML minifier
export function minifyHtml(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+>/g, '>')
    .replace(/<\s+/g, '<')
    .trim();
}

