/**
 * Toast notification — auto-dismisses after 4 seconds.
 * Appears at the bottom center of the viewport.
 * Supports an optional undo button.
 */

let currentToast = null;
let toastTimeout = null;

/**
 * Show a toast notification in the shadow root.
 * @param {ShadowRoot} shadowRoot
 * @param {string} message
 * @param {Object} [options]
 * @param {Function} [options.onUndo] - If provided, shows an "Undo" button
 */
export function showToast(shadowRoot, message, options = {}) {
  // Remove any existing toast
  hideToast();

  const toast = document.createElement('div');
  toast.className = 'pesto-toast';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (options.onUndo) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'pesto-toast-undo';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideToast();
      options.onUndo();
    });
    toast.appendChild(undoBtn);
  }

  shadowRoot.appendChild(toast);
  currentToast = toast;

  // Trigger enter animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });
  });

  // Auto-dismiss after 4 seconds
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 4000);
}

/**
 * Hide the current toast.
 */
export function hideToast() {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (currentToast) {
    currentToast.classList.remove('visible');
    const el = currentToast;
    currentToast = null;
    // Wait for fade-out then remove
    setTimeout(() => el.remove(), 300);
  }
}
