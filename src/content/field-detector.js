const TEXT_INPUT_TYPES = new Set([
  'text', 'email', 'tel', 'url', 'search', 'number', '',
]);

const SUPPRESSED_TYPES = new Set([
  'password', 'hidden', 'file', 'image', 'submit', 'reset', 'button',
  'checkbox', 'radio', 'range', 'color', 'date', 'datetime-local',
  'month', 'week', 'time',
]);

const SUPPRESSED_AUTOCOMPLETE = new Set([
  'current-password', 'new-password',
  'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-name', 'cc-type',
  'one-time-code',
]);

const SUPPRESSED_NAME_PATTERN =
  /password|passwd|passw|ssn|social.?security|card.?number|cvv|cvc|account.?number|routing.?number|pin|secret/i;

/**
 * Check if an element is a text input that Pesto should handle.
 */
export function isTextInput(el) {
  if (!el) return false;

  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || '').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }

  return false;
}

/**
 * Check if an input should be suppressed (password, credit card, SSN, etc.).
 */
export function shouldSuppress(el) {
  // Type-based suppression
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (SUPPRESSED_TYPES.has(type)) return true;

  // Autocomplete-based suppression
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (SUPPRESSED_AUTOCOMPLETE.has(autocomplete)) return true;

  // Name/id pattern suppression
  const name = el.getAttribute('name') || '';
  const id = el.id || '';
  if (SUPPRESSED_NAME_PATTERN.test(name) || SUPPRESSED_NAME_PATTERN.test(id)) return true;

  // aria-label pattern suppression
  const ariaLabel = el.getAttribute('aria-label') || '';
  if (SUPPRESSED_NAME_PATTERN.test(ariaLabel)) return true;

  // Dropdown / select-like input suppression
  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role === 'combobox' || role === 'listbox' || role === 'option') return true;
  const ariaHasPopup = (el.getAttribute('aria-haspopup') || '').toLowerCase();
  if (ariaHasPopup === 'listbox' || ariaHasPopup === 'menu' || ariaHasPopup === 'true') return true;
  // Suppress inputs inside a <select> wrapper or with a datalist
  if (el.hasAttribute('list')) return true;

  return false;
}

/**
 * Set up a MutationObserver to detect dynamically added inputs.
 * Calls onNewInput for each new text input found.
 */
export function observeDynamicInputs(onNewInput) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Check the node itself
        if (isTextInput(node) && !shouldSuppress(node)) {
          onNewInput(node);
        }

        // Check descendants
        if (node.querySelectorAll) {
          const inputs = node.querySelectorAll('input, textarea');
          for (const input of inputs) {
            if (isTextInput(input) && !shouldSuppress(input)) {
              onNewInput(input);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
