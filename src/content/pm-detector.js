/**
 * Detect password manager icons that may overlap with Pesto's button
 * and return an offset in pixels to shift Pesto left.
 */
export function getPMOffset(inputEl) {
  let offset = 0;

  // 1Password markers
  if (
    inputEl.hasAttribute('data-com-onepassword-filled') ||
    document.querySelector('com-1password-button') ||
    document.querySelector('[data-com-onepassword-filled]')
  ) {
    offset = Math.max(offset, 32);
  }

  // Bitwarden markers
  if (
    inputEl.hasAttribute('data-bwignore') ||
    document.querySelector('[class*="bitwarden"]')
  ) {
    offset = Math.max(offset, 32);
  }

  // LastPass markers
  if (
    inputEl.hasAttribute('data-lpignore') ||
    document.querySelector('[id^="lpform"]') ||
    document.querySelector('[class*="lastpass"]')
  ) {
    offset = Math.max(offset, 32);
  }

  // Dashlane markers
  if (document.querySelector('[id^="dashlane"]')) {
    offset = Math.max(offset, 32);
  }

  // Fallback: check for any element overlapping the input's right edge
  if (offset === 0) {
    try {
      const rect = inputEl.getBoundingClientRect();
      const checkX = rect.right - 14;
      const checkY = rect.top + rect.height / 2;
      const elements = document.elementsFromPoint(checkX, checkY);

      for (const el of elements) {
        if (el === inputEl) continue;
        if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;

        // Only consider small overlay icons, not parent containers
        const elRect = el.getBoundingClientRect();
        if (
          elRect.width <= 40 &&
          elRect.height < rect.height + 10 &&
          elRect.right > rect.right - 40 &&
          elRect.left < rect.right
        ) {
          const candidate = Math.ceil(rect.right - elRect.left) + 4;
          // Cap at 48px — no real PM icon is wider than this
          offset = Math.max(offset, Math.min(candidate, 48));
        }
      }
    } catch {
      // elementsFromPoint may fail in some contexts
    }
  }

  return offset;
}
