chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'focusMode') {
    if (request.enabled) {
      const overlay = document.createElement('div');
      overlay.id = 'ocuflow-focus-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(4px);
        z-index: 2147483647;
        pointer-events: none;
        transition: opacity 0.5s ease;
      `;
      document.body.appendChild(overlay);
    } else {
      const overlay = document.getElementById('ocuflow-focus-overlay');
      if (overlay) overlay.remove();
    }
  }
});

// Check initial state on load
chrome.storage.local.get(['focusMode'], (data) => {
  if (data.focusMode) {
    chrome.runtime.sendMessage({ action: 'toggleFocusMode', enabled: true });
  }
});
