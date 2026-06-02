/**
 * Answer Preview Tooltip — appears to the left of a hovered option row.
 * 318px fixed width, dark background, preserves line breaks.
 */

let currentTooltip = null;

/**
 * Show a tooltip with the full answer text, positioned to the left of the row.
 */
export function showTooltip(shadowRoot, { optionText, rowRect }) {
  hideTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'pesto-tooltip';
  tooltip.textContent = optionText;

  shadowRoot.appendChild(tooltip);
  currentTooltip = tooltip;

  // Always position to the left of the row
  requestAnimationFrame(() => {
    const tooltipWidth = 318;
    let left = rowRect.left - tooltipWidth - 8;
    let top = rowRect.top;

    // Clamp left edge so it doesn't go off-screen
    if (left < 10) left = 10;

    // If it would go off-screen bottom, shift up
    const tooltipHeight = tooltip.offsetHeight || 40;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tooltipHeight - 10;
    }

    if (top < 10) top = 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  });
}

/**
 * Hide the current tooltip.
 */
export function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}
