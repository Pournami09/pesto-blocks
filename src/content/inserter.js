/**
 * Insert text into a form field using the native setter pattern.
 * This ensures React/Vue/Svelte-controlled inputs register the change.
 *
 * Append behavior: if the field already has text, append with separator.
 * - \n for <textarea>
 * - space for <input>
 */
export function insertText(inputEl, text) {
  if (!inputEl || !text) return;

  const currentValue = inputEl.value || '';
  let newValue;

  if (!currentValue.trim()) {
    newValue = text;
  } else {
    const separator = inputEl.tagName === 'TEXTAREA' ? '\n' : ' ';
    newValue = currentValue + separator + text;
  }

  // Use the native prototype setter to bypass framework wrappers
  const prototype =
    inputEl.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(inputEl, newValue);
  } else {
    // Fallback: direct assignment (may not trigger framework change detection)
    inputEl.value = newValue;
  }

  // Dispatch events that frameworks listen for
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));

  // Also dispatch a more specific InputEvent for frameworks that check it
  try {
    inputEl.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
    );
  } catch {
    // InputEvent constructor may not be available in all contexts
  }
}
