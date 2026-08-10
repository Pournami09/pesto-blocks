/**
 * Pesto Dropdown Menu — the primary interaction surface.
 * Two variants: with answers (Save + Recents + option rows) and without (Save + empty state).
 */

// SVG icons (Geist/Lucide)
const PLUS_SVG = `<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;
const PENCIL_SVG = `<svg viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`;
const ENTER_SVG = `<svg viewBox="0 0 24 24"><path d="m9 10-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`;
const TRASH_SVG = `<svg viewBox="0 0 24 24"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

/**
 * Create the dropdown menu.
 * Returns { element, updatePosition, destroy }.
 */
export function createDropdownMenu({
  matches,
  matchError,
  detectedLabel,
  inputEl,
  onSaveClick,
  onOptionClick,
  onDeleteClick,
  onOptionHover,
  onOptionHoverEnd,
}) {
  const menu = document.createElement('div');
  menu.className = 'pesto-menu';

  // Size the menu to the input width with 320px minimum
  const inputRect = inputEl.getBoundingClientRect();
  const menuWidth = Math.max(inputRect.width, 320);
  menu.style.width = `${menuWidth}px`;

  // Save row (always present)
  const saveRow = document.createElement('div');
  saveRow.className = 'pesto-save-row';

  const saveIcon = document.createElement('div');
  saveIcon.className = 'pesto-icon-container';
  saveIcon.innerHTML = PLUS_SVG;

  const saveText = document.createElement('span');
  saveText.textContent = 'Save as new answer';

  saveRow.appendChild(saveIcon);
  saveRow.appendChild(saveText);
  saveRow.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveClick();
  });
  menu.appendChild(saveRow);

  const bestMatch = matches && matches.length > 0 ? matches[0] : null;

  if (bestMatch && bestMatch.options.length > 0) {
    // Variant A: Save + Recents + option rows

    // Recents label
    const label = document.createElement('div');
    label.className = 'pesto-recents-label';
    label.textContent = 'Recents';
    menu.appendChild(label);

    // Option rows
    bestMatch.options.forEach((optionText, index) => {
      const row = createOptionRow({
        optionText,
        index,
        pageId: bestMatch.id,
        questionName: bestMatch.canonical,
        onOptionClick,
        onDeleteClick,
        onOptionHover,
        onOptionHoverEnd,
      });
      menu.appendChild(row);
    });
  } else {
    // Variant B: Save + empty or error state
    const empty = document.createElement('div');
    empty.className = 'pesto-empty-state';
    if (matchError === 'reload') {
      empty.textContent = 'Pesto was reloaded — refresh this page.';
    } else if (matchError) {
      empty.textContent = 'Could not load suggestions. Try refreshing the page.';
    } else {
      const label = detectedLabel || 'this field';
      empty.textContent = `No saved answer for '${label}'.`;
    }
    menu.appendChild(empty);
  }

  // Position the menu
  positionMenu(menu, inputEl);

  function showSaved() {
    saveIcon.innerHTML = CHECK_SVG;
    saveText.textContent = 'Saved';
    saveRow.style.pointerEvents = 'none';
    saveRow.style.color = 'var(--pesto-green)';
  }

  return {
    element: menu,
    showSaved,
    updatePosition: () => positionMenu(menu, inputEl),
    destroy: () => menu.remove(),
  };
}

function createOptionRow({
  optionText,
  index,
  pageId,
  questionName,
  onOptionClick,
  onDeleteClick,
  onOptionHover,
  onOptionHoverEnd,
}) {
  const row = document.createElement('div');
  row.className = 'pesto-option-row';

  // Pencil icon (no-op in v1)
  const pencil = document.createElement('div');
  pencil.className = 'pesto-pencil-icon';
  pencil.innerHTML = PENCIL_SVG;
  row.appendChild(pencil);

  const displayText = optionText;
  const textEl = document.createElement('div');
  textEl.className = 'pesto-option-text';
  textEl.textContent = displayText;
  row.appendChild(textEl);

  // Action icons (revealed on hover)
  const actions = document.createElement('div');
  actions.className = 'pesto-option-actions';

  // Enter icon
  const enterIcon = document.createElement('div');
  enterIcon.className = 'pesto-action-icon';
  enterIcon.innerHTML = ENTER_SVG;
  enterIcon.title = 'Insert';
  actions.appendChild(enterIcon);

  // Trash icon
  const trashIcon = document.createElement('div');
  trashIcon.className = 'pesto-action-icon pesto-trash';
  trashIcon.innerHTML = TRASH_SVG;
  trashIcon.title = 'Delete';
  trashIcon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteClick({ pageId, optionIndex: index, optionText, questionName });
  });
  actions.appendChild(trashIcon);

  row.appendChild(actions);

  // Main row click -> insert (use displayText without bullet prefix)
  row.addEventListener('mousedown', (e) => {
    if (e.target.closest('.pesto-trash')) return;
    e.preventDefault();
    e.stopPropagation();
    onOptionClick({ optionText: displayText, questionName });
  });

  // Tooltip hover
  row.addEventListener('mouseenter', () => {
    const rowRect = row.getBoundingClientRect();
    onOptionHover({ optionText: displayText, rowRect, textEl });
  });

  row.addEventListener('mouseleave', () => {
    onOptionHoverEnd();
  });

  return row;
}

function positionMenu(menu, inputEl) {
  const inputRect = inputEl.getBoundingClientRect();
  const menuWidth = parseInt(menu.style.width, 10) || 320;

  // Default: 10px below the input, left-aligned
  let top = inputRect.bottom + 10;
  let left = inputRect.left;

  // Check if menu would go off-screen right
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (left < 10) left = 10;

  // Use actual height if rendered, otherwise estimate
  const menuHeight = menu.scrollHeight || 200;

  // Check if menu would go off-screen bottom — flip above if needed
  if (top + menuHeight > window.innerHeight - 10) {
    // Position so the menu's bottom edge is 10px above the input's top edge
    top = inputRect.top - menuHeight - 10;
    if (top < 10) top = 10;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}
