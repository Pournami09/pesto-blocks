/**
 * Delete confirmation dialog — "Move to Notion trash?"
 * Modal overlay within the shadow DOM.
 */

/**
 * Show a confirmation dialog and return a promise that resolves to true (confirm) or false (cancel).
 */
export function showConfirmDialog(shadowRoot, { questionName, optionIndex, optionText }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'pesto-confirm-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'pesto-confirm-dialog';

    const title = document.createElement('div');
    title.className = 'pesto-confirm-title';
    title.textContent = 'Move to Notion trash?';

    const body = document.createElement('div');
    body.className = 'pesto-confirm-body';
    const preview = optionText.length > 60
      ? optionText.substring(0, 60) + '...'
      : optionText;
    body.textContent = `'${questionName}' → option ${optionIndex + 1}: '${preview}' will be moved to Notion's trash. You can restore it within 30 days from Notion.`;

    const actions = document.createElement('div');
    actions.className = 'pesto-confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pesto-btn-confirm-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pesto-btn-confirm-delete';
    deleteBtn.textContent = 'Move to trash';
    deleteBtn.type = 'button';

    function cleanup(result) {
      backdrop.remove();
      resolve(result);
    }

    cancelBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    });

    deleteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(true);
    });

    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) {
        e.preventDefault();
        e.stopPropagation();
        cleanup(false);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(deleteBtn);
    dialog.appendChild(title);
    dialog.appendChild(body);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);

    shadowRoot.appendChild(backdrop);
  });
}
