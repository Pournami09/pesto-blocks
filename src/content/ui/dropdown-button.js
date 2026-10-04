/**
 * Pesto Dropdown Button — two pill halves (logo + chevron).
 * 20px tall, 4 states: Default, DefaultHover, DropdownOpen, DropdownOpenHover.
 */

// SVG for the Pesto logo (two stacked rounded rectangles, different widths)
const LOGO_SVG = `<svg width="14" height="14" viewBox="0 0 51 51" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10.5" y="4.5" width="30" height="19" rx="2" fill="#538700"/>
  <rect x="10.5" y="27.5" width="16" height="19" rx="2" fill="#538700"/>
</svg>`;

// SVG for the chevron (Geist/Lucide chevron-down)
const CHEVRON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m6 9 6 6 6-6"/>
</svg>`;

/**
 * Scan the input's vicinity for third-party extension icons (password managers,
 * etc.) that are injected as siblings and appear visually inside the input's
 * right side. Returns an additional left-offset so Pesto's button sits 16px
 * to the left of the detected icon rather than on top of it.
 */
function detectThirdPartyOffset(inputEl) {
  const ir = inputEl.getBoundingClientRect();
  if (ir.width === 0 || ir.height === 0) return 0;

  let maxOffset = 0;

  function check(el) {
    if (!el || el === inputEl || el.contains(inputEl)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;

    // Must be vertically within the input (with 2px tolerance)
    const withinV = r.top >= ir.top - 2 && r.bottom <= ir.bottom + 2;
    // Must occupy only the right portion of the input (rules out full-width wrappers)
    // and its right edge must not extend beyond the input's right edge
    const withinH = r.left > ir.left + ir.width * 0.5 && r.right <= ir.right + 4;

    if (withinV && withinH) {
      // Position Pesto 16px to the left of this element.
      // offset = (ir.right - r.left) + 12
      //   where 12 = desired 16px gap − the 4px already subtracted in positionButton
      const offset = (ir.right - r.left) + 12;
      maxOffset = Math.max(maxOffset, offset);
    }
  }

  // Most extensions inject a sibling right after the input
  const parent = inputEl.parentElement;
  if (parent) {
    for (const child of parent.children) check(child);
  }
  // Some inject one level higher
  if (parent?.parentElement) {
    for (const child of parent.parentElement.children) check(child);
  }

  return maxOffset;
}

/**
 * Create the dropdown button element.
 * Returns { element, setOpen, updatePosition, destroy }.
 */
export function createDropdownButton({ onToggle }) {
  const btn = document.createElement('div');
  btn.className = 'pesto-btn';
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Pesto autofill');

  const logoHalf = document.createElement('div');
  logoHalf.className = 'pesto-btn-logo';
  logoHalf.innerHTML = LOGO_SVG;

  const chevronHalf = document.createElement('div');
  chevronHalf.className = 'pesto-btn-chevron';
  chevronHalf.innerHTML = CHEVRON_SVG;

  btn.appendChild(logoHalf);
  btn.appendChild(chevronHalf);

  let isOpen = false;
  let rafId = null;
  let currentInputEl = null;
  let pmOffset = 0;
  let cachedThirdPartyOffset = 0;

  btn.addEventListener('mousedown', (e) => {
    // Use mousedown instead of click to fire before blur
    e.preventDefault();
    e.stopPropagation();
    isOpen = !isOpen;
    btn.classList.toggle('open', isOpen);
    onToggle(isOpen);
  });

  function updatePosition(inputEl, offset = 0) {
    currentInputEl = inputEl;
    pmOffset = offset;
    cachedThirdPartyOffset = detectThirdPartyOffset(inputEl);
    positionButton();
  }

  function positionButton() {
    if (!currentInputEl) return;
    const rect = currentInputEl.getBoundingClientRect();
    // Top-right corner inside the input, with 4px padding
    const top = rect.top + 4;
    const btnWidth = 40; // logo (20px) + chevron (20px)
    let left = rect.right - btnWidth - 4 - pmOffset - cachedThirdPartyOffset;
    // Clamp so the button never extends past the input's left edge
    if (left < rect.left + 4) {
      left = rect.left + 4;
    }
    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      positionButton();
      rafId = null;
    });
  }

  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);

  function setOpen(open) {
    isOpen = open;
    btn.classList.toggle('open', isOpen);
  }

  function destroy() {
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
    if (rafId) cancelAnimationFrame(rafId);
    btn.remove();
  }

  return { element: btn, setOpen, updatePosition, destroy };
}
