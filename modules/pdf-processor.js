// PDF Processor Module
// Handles PDF generation from web pages

// Save page as PDF
export async function saveAsPdf(options, dependencies) {
  const { saveBtn, showStatus, sanitizeFilename, savedCount, 
          extractHiddenCheckbox, removeControlsCheckbox, preserveColorsCheckbox } = dependencies;
  
  try {
    saveBtn.disabled = true;
    showStatus('Processing content for PDF...', 'info');

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

    // Get PDF options - use simple HTML extraction with cleanup
    const pdfOptions = {
      includeImages: true,  // Always include images for PDF
      includeStyles: true,  // Always include styles for PDF
      extractHidden: options.extractHidden,
      removeControls: options.removeControls,
      preserveColors: options.preserveColors
    };

    // Execute simplified content extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentForPdfWrapper,
      args: [pdfOptions]
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract page content for PDF');
    }

    const pageData = results[0].result;
    
    // Log for debugging
    console.log('PDF Page Data:', pageData);
    console.log('Extracted images count:', pageData.extractedImages ? pageData.extractedImages.length : 0);

    showStatus(`Generating PDF (${pageData.extractedImages?.length || 0} images found)...`, 'info');

    // Generate clean HTML for PDF
    const pdfHtml = generateSimplePdfHtml(pageData, pdfOptions);

    // Create filename
    const filename = sanitizeFilename(pageData.title || 'page') + '.pdf';

    // Create a blob and save using Chrome's print to PDF
    const blob = new Blob([pdfHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Create a new tab with the processed content
    const newTab = await chrome.tabs.create({ 
      url: blobUrl,
      active: false  // Keep in background
    });

    // Wait for the tab to load
    await new Promise(resolve => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    // Give it time to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    showStatus('Opening PDF preview...', 'info');

    // Show the tab for printing
    await chrome.tabs.update(newTab.id, { active: true });
    
    // Inject script to auto-trigger print dialog
    await chrome.scripting.executeScript({
      target: { tabId: newTab.id },
      func: () => {
        const banner = document.createElement('div');
        banner.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px 30px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); z-index: 999999; font-family: system-ui; text-align: center; max-width: 500px;';
        banner.innerHTML = `
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">📄 PDF Ready to Save</div>
          <div style="font-size: 15px; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 6px; margin-top: 10px;">
            In Print Dialog:<br>
            <strong>Destination</strong> → <strong>Save as PDF</strong> → <strong>Save</strong>
          </div>
          <div style="font-size: 12px; margin-top: 10px; opacity: 0.9;">This tab will close automatically after saving</div>
        `;
        document.body.prepend(banner);
        
        // Log images for debugging
        const images = document.querySelectorAll('img');
        console.log('Total images in PDF:', images.length);
        console.log('Images with base64:', Array.from(images).filter(img => img.src.startsWith('data:')).length);
        
        // Listen for print events
        window.addEventListener('afterprint', () => {
          banner.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
          banner.innerHTML = '<div style="font-size: 18px; font-weight: bold;">✓ PDF Saved! Closing...</div>';
          setTimeout(() => window.close(), 1500);
        });
        
        // Auto-close after 60 seconds
        setTimeout(() => window.close(), 60000);
        
        // Auto-trigger print dialog after slight delay
        setTimeout(() => window.print(), 800);
      }
    });
    
    // Clean up blob URL after some time
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 5000);
    
    showStatus('✓ Print dialog opened - select "Save as PDF" to download', 'success');

    // Update statistics
    const result = await chrome.storage.local.get(['savedCount']);
    const newCount = (result.savedCount || 0) + 1;
    await chrome.storage.local.set({ savedCount: newCount });
    savedCount.textContent = newCount;

    showStatus('✓ PDF generation started...', 'success');

  } catch (error) {
    console.error('Error saving PDF:', error);
    showStatus('✗ Error: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// Extract page content for PDF (injected function)
export async function extractPageContentForPdfWrapper(options) {
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const DATASET_IMAGE_KEYS = [
    'src',
    'original',
    'originalSrc',
    'lazy',
    'lazySrc',
    'lazySrcset',
    'lazySrcSet',
    'image',
    'imageSrc',
    'bg',
    'bgSrc',
    'background',
    'backgroundImage',
    'defaultSrc',
    'fallbackSrc'
  ];
  
  const ATTRIBUTE_IMAGE_KEYS = [
    'data-src',
    'data-srcset',
    'data-sizes',
    'data-src-mobile',
    'data-src-desktop',
    'data-original',
    'data-original-src',
    'data-lazy',
    'data-lazy-src',
    'data-lazy-srcset',
    'data-image',
    'data-image-src',
    'data-bg',
    'data-bg-src',
    'data-background',
    'data-background-image',
    'data-default-src',
    'data-placeholder'
  ];
  
  const BACKGROUND_ATTRIBUTE_SELECTORS = [
    '[data-bg]',
    '[data-bg-src]',
    '[data-background]',
    '[data-background-image]',
    '[data-image]',
    '[data-image-src]',
    '[data-lazy-background]',
    '[data-lazy-bg]',
    '[data-default-src]'
  ];
  
  const DATASET_BACKGROUND_KEYS = [
    'bg',
    'bgSrc',
    'background',
    'backgroundImage',
    'image',
    'imageSrc',
    'lazyBackground',
    'lazyBg',
    'defaultSrc'
  ];
  
  const SOURCESET_DATASET_KEYS = [
    'srcset',
    'srcSet',
    'lazySrcset',
    'lazySrcSet'
  ];
  
  const SOURCESET_ATTRIBUTE_KEYS = [
    'data-srcset',
    'data-src-set',
    'data-lazy-srcset',
    'data-lazy-src-set'
  ];
  
  const toAbsoluteUrl = (url) => {
    if (!url) return url;
    if (/^(data:|blob:|https?:)/i.test(url)) return url;
    try {
      return new URL(url, document.baseURI).href;
    } catch (e) {
      return url;
    }
  };
  
  const normalizeBackgroundValue = (value) => {
    if (!value) return null;
    if (/\bgradient\b/i.test(value)) return null;
    const match = value.match(/url\(["']?([^"')]+)["']?\)/i);
    if (match && match[1]) {
      return toAbsoluteUrl(match[1]);
    }
    return toAbsoluteUrl(value);
  };
  
  const observeImageElement = (img) => {
    if (!img) return Promise.resolve();
    if (img.complete && img.naturalHeight > 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, 3500);
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  };
  
  const preloadImage = (url) => {
    if (!url || url.startsWith('data:')) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, 3500);
      const loader = new Image();
      loader.crossOrigin = 'anonymous';
      loader.onload = loader.onerror = () => {
        clearTimeout(timeout);
        resolve();
      };
      loader.src = url;
    });
  };
  
  const pickFirstValue = (el, datasetKeys, attributeKeys) => {
    if (!el) return null;
    const dataset = el.dataset || {};
    for (const key of datasetKeys) {
      if (dataset[key]) {
        return dataset[key];
      }
    }
    for (const attr of attributeKeys) {
      const value = el.getAttribute(attr);
      if (value) {
        return value;
      }
    }
    return null;
  };
  
  const triggerLazyLoadScroll = async () => {
    const originalScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const step = Math.max(window.innerHeight * 0.6, 200);
    
    for (let position = 0; position < maxScroll; position += step) {
      window.scrollTo(0, position);
      window.dispatchEvent(new Event('scroll'));
      await wait(40);
    }
    
    window.scrollTo(0, originalScrollTop);
    window.dispatchEvent(new Event('scroll'));
    await wait(60);
  };
  
  const forceLoadLazyAssets = async () => {
    const loadPromises = [];
    
    document.querySelectorAll('source').forEach(source => {
      const srcsetCandidate = pickFirstValue(source, SOURCESET_DATASET_KEYS, SOURCESET_ATTRIBUTE_KEYS);
      if (srcsetCandidate && !source.srcset) {
        source.srcset = srcsetCandidate;
      }
    });
    
    document.querySelectorAll('img').forEach(img => {
      const dataset = img.dataset || {};
      
      const srcsetCandidate = pickFirstValue(img, SOURCESET_DATASET_KEYS, SOURCESET_ATTRIBUTE_KEYS);
      if (srcsetCandidate && !img.srcset) {
        img.srcset = srcsetCandidate;
      }
      if (dataset.sizes && !img.sizes) {
        img.sizes = dataset.sizes;
      }
      const srcCandidate = pickFirstValue(img, DATASET_IMAGE_KEYS, ATTRIBUTE_IMAGE_KEYS);
      if (srcCandidate && (!img.src || img.src === '' || img.src === '#' || img.src.startsWith('data:') || img.src.includes('placeholder'))) {
        img.src = toAbsoluteUrl(srcCandidate);
      }
      
      if (img.getAttribute('loading') === 'lazy') {
        img.setAttribute('loading', 'eager');
      }
      img.classList.remove('lazyload', 'lazy-load', 'lazyloaded', 'lazy');
      
      loadPromises.push(observeImageElement(img));
    });
    
    const bgSelector = BACKGROUND_ATTRIBUTE_SELECTORS.join(', ');
    if (bgSelector) {
      document.querySelectorAll(bgSelector).forEach(elem => {
        const backgroundCandidate = pickFirstValue(elem, DATASET_BACKGROUND_KEYS, ATTRIBUTE_IMAGE_KEYS);
        const normalized = normalizeBackgroundValue(backgroundCandidate);
        if (normalized) {
          elem.style.backgroundImage = `url("${normalized}")`;
          loadPromises.push(preloadImage(normalized));
        }
      });
    }
    
    document.querySelectorAll('[style*="--lazy-background"]').forEach(elem => {
      const value = getComputedStyle(elem).getPropertyValue('--lazy-background');
      const normalized = normalizeBackgroundValue(value);
      if (normalized) {
        elem.style.backgroundImage = `url("${normalized}")`;
        loadPromises.push(preloadImage(normalized));
      }
    });
    
    if (loadPromises.length) {
      await Promise.race([
        Promise.allSettled(loadPromises),
        wait(4000)
      ]);
    }
  };
  
  try {
    await triggerLazyLoadScroll();
    await forceLoadLazyAssets();
  } catch (e) {
    console.warn('Lazy asset preload failed:', e);
  }
  
  const doc = document.cloneNode(true);
  
  // Get page title
  const title = document.title;
  
  // Clone body for processing
  const bodyClone = document.body.cloneNode(true);
  
  // Process accordions: extract headers and associate with bodies
  const accordionBodies = bodyClone.querySelectorAll('.accordion__body');
  console.log(`Found ${accordionBodies.length} accordion bodies`);
  
  accordionBodies.forEach((accordionBody, index) => {
    // Get ID of accordion body to find matching header
    const bodyId = accordionBody.id;
    let headerText = '';
    
    // Strategy 1: Find button with data-target pointing to this accordion body
    if (bodyId) {
      const button = bodyClone.querySelector(`button[data-target="#${bodyId}"], a[data-target="#${bodyId}"]`);
      if (button) {
        // Try to find accordion__title inside button
        const titleSpan = button.querySelector('.accordion__title, [class*="accordion__title"]');
        if (titleSpan) {
          headerText = titleSpan.textContent.trim();
        }
        
        // If no title span, check title attribute
        if (!headerText) {
          headerText = button.getAttribute('title')?.trim();
        }
        
        // If still no title, try button text content
        if (!headerText) {
          headerText = button.textContent.trim();
        }
        
        if (headerText) {
          console.log(`✓ Found header via data-target: "${headerText}"`);
        }
      }
    }
    
    // Strategy 2: Find by ID pattern (replace body with header in ID)
    if (!headerText && bodyId) {
      const patterns = [
        bodyId.replace('accordion__body', 'accordion__header'),
        bodyId.replace('__body', '__header'),
        bodyId.replace('-body-', '-header-'),
        bodyId.replace('body-', 'header-')
      ];
      
      for (const headerId of patterns) {
        const header = bodyClone.querySelector(`#${headerId}`);
        if (header) {
          headerText = header.textContent.trim();
          if (headerText) {
            console.log(`✓ Found header by ID pattern: ${headerId}`);
            break;
          }
        }
      }
    }
    
    // Strategy 3: Look for accordion__header or button in parent
    if (!headerText) {
      let currentElement = accordionBody;
      for (let i = 0; i < 5; i++) {
        if (!currentElement.parentElement) break;
        currentElement = currentElement.parentElement;
        
        // Try to find button with title
        const buttonInParent = currentElement.querySelector('button[title], a[title]');
        if (buttonInParent && buttonInParent.getAttribute('title')) {
          headerText = buttonInParent.getAttribute('title').trim();
          if (headerText) {
            console.log(`✓ Found header via button[title] in parent level ${i+1}`);
            break;
          }
        }
        
        // Try accordion__header
        const headerInParent = currentElement.querySelector('.accordion__header, [class*="accordion__title"]');
        if (headerInParent) {
          headerText = headerInParent.textContent.trim();
          if (headerText) {
            console.log(`✓ Found header in parent level ${i+1}`);
            break;
          }
        }
      }
    }
    
    // Insert heading if found
    if (headerText) {
      console.log(`Accordion ${index + 1}: "${headerText}"`);
      
      const heading = document.createElement('h3');
      heading.textContent = headerText;
      heading.style.cssText = `
        margin-top: 24px;
        margin-bottom: 12px;
        color: #2c3e50;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #3498db;
        padding-bottom: 8px;
        page-break-after: avoid;
      `;
      
      // Insert heading before accordion body
      accordionBody.parentNode.insertBefore(heading, accordionBody);
    } else {
      console.warn(`✗ No header found for accordion ${index + 1}:`, bodyId);
    }
    
    // Expand accordion content
    accordionBody.classList.remove('collapse');
    accordionBody.classList.add('show', 'in');
    accordionBody.removeAttribute('aria-hidden');
    accordionBody.removeAttribute('hidden');
    accordionBody.style.display = 'block';
    accordionBody.style.visibility = 'visible';
    accordionBody.style.height = 'auto';
    accordionBody.style.overflow = 'visible';
  });
  
  // Expand other collapsed elements
  bodyClone.querySelectorAll('.collapse').forEach(elem => {
    elem.classList.remove('collapse');
    elem.classList.add('show', 'in');
    elem.removeAttribute('aria-hidden');
    elem.removeAttribute('hidden');
    elem.style.display = '';
    elem.style.visibility = 'visible';
    elem.style.height = 'auto';
  });
  
  bodyClone.querySelectorAll('[aria-expanded="false"]').forEach(elem => {
    elem.setAttribute('aria-expanded', 'true');
  });
  
  bodyClone.querySelectorAll('details').forEach(elem => {
    elem.setAttribute('open', '');
  });
  
  bodyClone.querySelectorAll('[aria-hidden="true"]').forEach(elem => {
    elem.removeAttribute('aria-hidden');
    elem.style.display = '';
    elem.style.visibility = 'visible';
  });
  
  bodyClone.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden], .hidden').forEach(elem => {
    elem.removeAttribute('hidden');
    elem.classList.remove('hidden');
    if (!elem.matches('script, style, noscript')) {
      elem.style.display = '';
      elem.style.visibility = 'visible';
    }
  });
  
  console.log('Expanded all collapsed accordion and hidden content');
  
  // Remove unwanted elements
  if (options.removeControls) {
    bodyClone.querySelectorAll('script, noscript, style').forEach(el => el.remove());
    bodyClone.querySelectorAll('nav, header, footer, [role="navigation"], .navigation').forEach(el => el.remove());
    bodyClone.querySelectorAll('button, input, select, textarea, a.button, [class*="button"], [class*="Button"]').forEach(el => el.remove());
    bodyClone.querySelectorAll('[class*="toolbar"], [class*="Toolbar"], [id*="toolbar"], [class*="menu"], [class*="Menu"], [id*="menu"]').forEach(el => el.remove());
    bodyClone.querySelectorAll('.pager, [class*="pager"], [class*="Pager"], .pagination, [class*="prev"], [class*="next"], [class*="Prev"], [class*="Next"]').forEach(el => el.remove());
    bodyClone.querySelectorAll('.modal__dismiss, .modal__backdrop, [class*="dismiss"], [data-dismiss]').forEach(el => el.remove());
    
    console.log('Removed interactive controls and navigation');
  }
  
  // Collect all images
  const extractedImages = [];
  
  // Helper function to convert image to base64
  function imageToBase64(img) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Could not convert image:', e);
      return img.src;
    }
  }
  
  // Handle regular images - convert to base64 and keep in place
  if (options.includeImages) {
    const images = document.querySelectorAll('img');
    const clonedImages = bodyClone.querySelectorAll('img');
    
    console.log('Processing', images.length, 'regular images');
    
    images.forEach((img, index) => {
      if (img.complete && img.naturalHeight > 0 && clonedImages[index]) {
        try {
          const base64 = imageToBase64(img);
          clonedImages[index].src = base64;
          
          // Ensure image stays in place with proper sizing
          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;
          
          // Use original size or max 900px width
          if (imgWidth > 900) {
            clonedImages[index].style.width = '900px';
            clonedImages[index].style.height = 'auto';
          } else {
            clonedImages[index].style.width = imgWidth + 'px';
            clonedImages[index].style.height = 'auto';
          }
          
          clonedImages[index].style.display = 'block';
          clonedImages[index].style.margin = '20px auto';
          
          console.log(`✓ Image ${index + 1}: ${imgWidth}×${imgHeight} → base64`);
          extractedImages.push({ type: 'regular', index });
        } catch (e) {
          console.warn('Could not inline image:', e);
        }
      }
    });
    
    // Find elements with background-images (only in specific image containers)
    const imageContainerSelectors = [
      '.image', '[class*="image"]', 
      '.carousel__image', '[class*="carousel"]',
      '.explorer__item', '[class*="explorer"]',
      '.media', '[class*="media"]',
      '[class*="photo"]', '[class*="picture"]',
      '[data-role="image"]'
    ];
    
    const allElements = document.querySelectorAll(imageContainerSelectors.join(', '));
    const elementsWithBgImage = [];
    
    allElements.forEach(elem => {
      const bgValue = window.getComputedStyle(elem).backgroundImage;
      const normalized = normalizeBackgroundValue(bgValue);
      if (normalized) {
        elementsWithBgImage.push(elem);
      }
    });
    
    console.log('Found', elementsWithBgImage.length, 'image containers with background-image');
    
    const processedUrls = new Set();
    const clonedImageContainers = bodyClone.querySelectorAll(imageContainerSelectors.join(', '));
    
    elementsWithBgImage.forEach((originalElem, idx) => {
      // Find matching cloned element by ID or position
      let clonedElem = null;
      
      if (originalElem.id) {
        clonedElem = bodyClone.querySelector(`#${originalElem.id}`);
      } else {
        // Match by index in the same selector
        const allMatching = Array.from(allElements);
        const elemIndex = allMatching.indexOf(originalElem);
        if (elemIndex >= 0 && elemIndex < clonedImageContainers.length) {
          clonedElem = clonedImageContainers[elemIndex];
        }
      }
      
      if (clonedElem) {
        const bgValue = window.getComputedStyle(originalElem).backgroundImage;
        const normalized = normalizeBackgroundValue(bgValue);
        if (normalized) {
          if (processedUrls.has(normalized)) return;
          processedUrls.add(normalized);
          
          console.log(`Background-image ${idx + 1}:`, normalized);
          
          const allLoadedImages = document.querySelectorAll('img');
          let foundImg = null;
          
          for (let loadedImg of allLoadedImages) {
            const absSrc = toAbsoluteUrl(loadedImg.src);
            if (absSrc === normalized && loadedImg.complete && loadedImg.naturalHeight > 0) {
              foundImg = loadedImg;
              break;
            }
          }
          
          let imgTag = '';
          if (foundImg) {
            try {
              const base64 = imageToBase64(foundImg);
              const imgWidth = foundImg.naturalWidth;
              const imgHeight = foundImg.naturalHeight;
              const containerWidth = originalElem.offsetWidth;
              
              let displayWidth = imgWidth;
              let displayHeight = imgHeight;
              
              if (containerWidth > 0 && containerWidth < imgWidth) {
                displayWidth = containerWidth;
                displayHeight = Math.round(imgHeight * (containerWidth / imgWidth));
              }
              
              const altText = originalElem.getAttribute('aria-label') || 
                            originalElem.getAttribute('title') || 
                            originalElem.getAttribute('alt') || '';
              
              imgTag = `<img src="${base64}" alt="${altText}" style="width: ${displayWidth}px; height: ${displayHeight}px; display: block; margin: 20px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
              console.log(`  ✓ Converted to base64`);
            } catch (e) {
              console.warn('  → Error converting:', e);
              imgTag = `<img src="${normalized}" alt="" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">`;
            }
          } else {
            const altText = originalElem.getAttribute('aria-label') || originalElem.getAttribute('title') || '';
            imgTag = `<img src="${normalized}" alt="${altText}" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">`;
          }
          
          if (imgTag) {
            // Проверяем, есть ли уже <img> внутри элемента
            const hasChildImages = clonedElem.querySelector('img');
            
            if (!hasChildImages && !clonedElem.textContent.trim()) {
              // Если элемент пустой или только фон - заменяем на изображение
              clonedElem.innerHTML = imgTag;
              clonedElem.style.backgroundImage = 'none';
              clonedElem.style.display = 'block';
              clonedElem.style.margin = '20px 0';
              clonedElem.style.textAlign = 'center';
            } else {
              // Если есть контент - создаём wrapper для изображения
              const wrapper = document.createElement('div');
              wrapper.innerHTML = imgTag;
              wrapper.style.cssText = 'margin: 20px 0; text-align: center;';
              
              // Вставляем перед содержимым
              clonedElem.insertBefore(wrapper, clonedElem.firstChild);
              clonedElem.style.backgroundImage = 'none';
            }
            
            extractedImages.push({ inserted: true });
          }
        }
      }
    });
    
    console.log('Total background images inserted:', extractedImages.length);
  }
  
  // Handle styles
  let inlineStyles = '';
  if (options.includeStyles) {
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          return '';
        }
      })
      .filter(css => css)
      .join('\n');
    
    inlineStyles = styles;
  }
  
  console.log('Total extracted images:', extractedImages.length);
  
  // FINAL STEP: Remove video elements (unless explicitly included)
  if (!options.includeVideos) {
    const videoCount = bodyClone.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
    bodyClone.querySelectorAll('video').forEach(el => {
      console.log('Removing video element:', el.src || el.currentSrc || 'streaming');
      el.remove();
    });
    // Also remove video iframes
    bodyClone.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player"]').forEach(el => {
      console.log('Removing video iframe:', el.src);
      el.remove();
    });
    if (videoCount > 0) {
      console.log(`✓ Removed ${videoCount} video elements from PDF`);
    }
  } else {
    // If videos included, replace with placeholder
    bodyClone.querySelectorAll('video').forEach(video => {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'background: #f0f0f0; border: 2px dashed #999; padding: 20px; text-align: center; color: #666; border-radius: 8px; margin: 12px 0;';
      placeholder.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">🎥 Video Element</div>
        <div style="font-size: 12px;">${video.src || video.currentSrc || 'Streaming video'}</div>
        ${video.duration ? `<div style="font-size: 12px; margin-top: 4px;">Duration: ${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}</div>` : ''}
      `;
      video.replaceWith(placeholder);
    });
    console.log('Replaced video elements with placeholders');
  }
  
  return {
    title: title,
    html: bodyClone.innerHTML,
    styles: inlineStyles,
    extractedImages: extractedImages
  };
}

// Generate simple PDF HTML from page data
export function generateSimplePdfHtml(pageData, options) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${pageData.title}</title>
  <style>
    /* Reset and base styles */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    /* PDF-friendly body */
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      color: #000 !important;
      max-width: 900px;
      margin: 0 auto;
      padding: 16px 20px 28px;
      background: white;
      font-size: 14px !important; /* Base font size */
    }
    
    /* Limit maximum font sizes */
    * {
      max-font-size: 14px;
    }
    
    p, span, div, li, td, th {
      font-size: 14px !important;
      line-height: 1.6 !important;
    }
    
    /* Reasonable heading sizes */
    h1 { font-size: 24px !important; }
    h2 { font-size: 20px !important; }
    h3 { font-size: 18px !important; }
    h4, h5, h6 { font-size: 16px !important; }
    
    /* Text color handling - conditional */
    ${!options.preserveColors ? `
    /* Force all text to be black for better readability */
    *, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a {
      color: #000 !important;
    }
    ` : `
    /* Preserve original colors but ensure readability */
    body {
      background: white !important;
    }
    `}
    
    /* Hide unwanted elements in PDF */
    nav, header, footer, button, input, select, textarea,
    [class*="toolbar"], [class*="menu"], [class*="navigation"],
    [role="navigation"], .modal__backdrop, .modal__dismiss {
      display: none !important;
    }
    
    /* Images */
    img {
      max-width: 100% !important;
      height: auto !important;
      page-break-inside: avoid;
      margin: 15px 0;
      display: block;
    }
    
    /* Headings - unified with limits above */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      margin-top: 20px;
      margin-bottom: 12px;
      color: #1a1a1a !important;
    }
    
    h1 { border-bottom: 2px solid #667eea; padding-bottom: 8px; }
    h2 { border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    h3 { padding-bottom: 4px; }
    
    /* Paragraphs and text */
    p {
      margin: 10px 0;
      orphans: 3;
      widows: 3;
    }
    
    /* Lists */
    ul, ol {
      margin: 12px 0 12px 30px;
    }
    li {
      margin: 6px 0;
    }
    
    /* Hide video elements (unless includeVideos option is enabled) */
    ${!options.includeVideos ? `
    video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      width: 0 !important;
    }
    ` : ''}
    
    /* Print optimization */
    @media print {
      body { padding: 8px 12px 20px; }
      img, h1, h2, h3, h4, h5, h6 {
        page-break-inside: avoid;
      }
      @page {
        margin: 12mm 14mm 18mm;
      }
    }
    
    /* Original page styles (filtered) */
    ${pageData.styles}
  </style>
</head>
<body>`;

  // Add main content (images are now embedded inline)
  html += pageData.html;
  
  html += `
</body>
</html>`;

  return html;
}

