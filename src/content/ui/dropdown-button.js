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
    positionButton();
  }

  function positionButton() {
    if (!currentInputEl) return;
    const rect = currentInputEl.getBoundingClientRect();
    // Top-right corner inside the input, with 4px padding
    const top = rect.top + 4;
    const btnWidth = 40; // logo (20px) + chevron (20px)
    let left = rect.right - btnWidth - 4 - pmOffset;
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
