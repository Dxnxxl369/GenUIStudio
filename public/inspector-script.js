(function() {
  let isInspectorActive = false;
  let inspectorStyle = null;
  let currentHighlight = null;

  // Function to get relevant styles
  function getRelevantStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    const relevantProps = [
      'display', 'position', 'width', 'height', 'margin', 'padding',
      'border', 'background', 'color', 'font-size', 'font-family',
      'text-align', 'flex-direction', 'justify-content', 'align-items'
    ];
    
    const styles = {};
    relevantProps.forEach(prop => {
      const value = computedStyles.getPropertyValue(prop);
      if (value) styles[prop] = value;
    });
    
    return styles;
  }

  // Function to create a readable element selector
  function createReadableSelector(element) {
    let selector = element.tagName.toLowerCase();
    
    // Add ID if present
    if (element.id) {
      selector += `#${element.id}`;
    }
    
    // Add classes if present
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }
      
      if (className.trim()) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }

  // Function to create element display text
  function createElementDisplayText(element) {
    const tagName = element.tagName.toLowerCase();
    let displayText = `<${tagName}`;
    
    // Add ID attribute
    if (element.id) {
      displayText += ` id="${element.id}"`;
    }
    
    // Add class attribute (limit to first 3 classes for readability)
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }
      
      if (className.trim()) {
        const classes = className.trim().split(/\s+/);
        const displayClasses = classes.length > 3 ? 
          classes.slice(0, 3).join(' ') + '...' : 
          classes.join(' ');
        displayText += ` class="${displayClasses}"`;
      }
    }
    
    // Add other important attributes
    const importantAttrs = ['type', 'name', 'href', 'src', 'alt', 'title'];
    importantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        const truncatedValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
        displayText += ` ${attr}="${truncatedValue}"`;
      }
    });
    
    displayText += '>';
    
    // Add text content preview for certain elements
    const textElements = ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label'];
    if (textElements.includes(tagName) && element.textContent) {
      const textPreview = element.textContent.trim().substring(0, 50);
      if (textPreview) {
        displayText += textPreview.length < element.textContent.trim().length ? 
          textPreview + '...' : textPreview;
      }
    }
    
    displayText += `</${tagName}>`;
    
    return displayText;
  }

  // Function to create element info
  function createElementInfo(element) {
    const rect = element.getBoundingClientRect();
    
    return {
      tagName: element.tagName,
      className: getElementClassName(element),
      id: element.id || '',
      textContent: element.textContent?.slice(0, 100) || '',
      styles: getRelevantStyles(element),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      },
      // Add new readable formats
      selector: createReadableSelector(element),
      displayText: createElementDisplayText(element),
      elementPath: getElementPath(element)
    };
  }

  // Helper function to get element class name consistently
  function getElementClassName(element) {
    if (!element.className) return '';
    
    if (typeof element.className === 'string') {
      return element.className;
    } else if (element.className.baseVal !== undefined) {
      return element.className.baseVal;
    } else {
      return element.className.toString();
    }
  }

  // Function to get element path (breadcrumb)
  function getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body && current !== document.documentElement) {
      let pathSegment = current.tagName.toLowerCase();
      
      if (current.id) {
        pathSegment += `#${current.id}`;
      } else if (current.className) {
        const className = getElementClassName(current);
        if (className.trim()) {
          const firstClass = className.trim().split(/\s+/)[0];
          pathSegment += `.${firstClass}`;
        }
      }
      
      path.unshift(pathSegment);
      current = current.parentElement;
      
      // Limit path length
      if (path.length >= 5) break;
    }
    
    return path.join(' > ');
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isInspectorActive) return;
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    // Remove previous highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
    }
    
    // Add highlight to current element
    target.classList.add('inspector-highlight');
    currentHighlight = target;

    const elementInfo = createElementInfo(target);
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_HOVER',
      elementInfo: elementInfo
    }, '*');
  }

  function handleClick(e) {
    if (!isInspectorActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    const elementInfo = createElementInfo(target);
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_CLICK',
      elementInfo: elementInfo
    }, '*');
  }

  function handleMouseLeave() {
    if (!isInspectorActive) return;
    
    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
      currentHighlight = null;
    }
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_LEAVE'
    }, '*');
  }

  // Function to activate/deactivate inspector
  function setInspectorActive(active) {
    isInspectorActive = active;
    
    if (active) {
      // Add inspector styles
      if (!inspectorStyle) {
        inspectorStyle = document.createElement('style');
        inspectorStyle.textContent = `
          .inspector-active * {
            cursor: crosshair !important;
          }
          .inspector-highlight {
            outline: 2px solid #3b82f6 !important;
            outline-offset: -2px !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
        `;
        document.head.appendChild(inspectorStyle);
      }
      
      document.body.classList.add('inspector-active');
      
      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
    } else {
      document.body.classList.remove('inspector-active');
      
      // Remove highlight
      if (currentHighlight) {
        currentHighlight.classList.remove('inspector-highlight');
        currentHighlight = null;
      }
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      
      // Remove styles
      if (inspectorStyle) {
        inspectorStyle.remove();
        inspectorStyle = null;
      }
    }
  }

  // Listen for messages from parent
  window.addEventListener('message', function(event) {
    if (event.data.type === 'INSPECTOR_ACTIVATE') {
      setInspectorActive(event.data.active);
    } else if (event.data.type === 'BOLT_STORAGE_SET') {
      try {
        const { key, value } = event.data;
        if (key && value !== undefined) {
          localStorage.setItem(key, value);
          window.dispatchEvent(new Event('storage'));
        }
      } catch (e) {}
    }
  });

  // ==========================================
  // Storage Synchronization to Parent Window
  // ==========================================
  function syncAllStorage() {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('bolt-') && !key.startsWith('sb-') && key !== 'theme') {
          data[key] = localStorage.getItem(key);
        }
      }
      if (Object.keys(data).length > 0) {
        window.parent.postMessage({
          type: 'BOLT_STORAGE_SYNC_BULK',
          data: data
        }, '*');
      }
    } catch (e) {}
  }

  // Intercept localStorage methods
  try {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      try {
        window.parent.postMessage({
          type: 'BOLT_STORAGE_SYNC',
          action: 'set',
          key: String(key),
          value: String(value)
        }, '*');
      } catch (e) {}
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      originalRemoveItem.apply(this, arguments);
      try {
        window.parent.postMessage({
          type: 'BOLT_STORAGE_SYNC',
          action: 'remove',
          key: String(key)
        }, '*');
      } catch (e) {}
    };

    const originalClear = localStorage.clear;
    localStorage.clear = function() {
      originalClear.apply(this, arguments);
      try {
        window.parent.postMessage({
          type: 'BOLT_STORAGE_SYNC',
          action: 'clear'
        }, '*');
      } catch (e) {}
    };
  } catch (e) {
    console.warn('[inspector] Storage interception failed:', e);
  }

  // Intercept IndexedDB in preview if used
  try {
    if (typeof IDBObjectStore !== 'undefined' && IDBObjectStore.prototype) {
      const origPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) {
        const storeName = this.name;
        const res = origPut.apply(this, arguments);
        try {
          window.parent.postMessage({
            type: 'BOLT_IDB_SYNC_ROW',
            store: storeName,
            row: value
          }, '*');
        } catch (e) {}
        return res;
      };

      const origAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function(value, key) {
        const storeName = this.name;
        const res = origAdd.apply(this, arguments);
        try {
          window.parent.postMessage({
            type: 'BOLT_IDB_SYNC_ROW',
            store: storeName,
            row: value
          }, '*');
        } catch (e) {}
        return res;
      };
    }
  } catch (e) {}

  // Initial syncs
  syncAllStorage();
  setTimeout(syncAllStorage, 800);
  setTimeout(syncAllStorage, 2500);

  // Auto-inject if inspector is already active
  window.parent.postMessage({ type: 'INSPECTOR_READY' }, '*');
})();