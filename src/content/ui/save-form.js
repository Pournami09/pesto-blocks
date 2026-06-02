import { ANSWER_CHAR_LIMIT, ANSWER_WARN_LIMIT } from '../../lib/constants.js';

/**
 * Create the inline save form that appears below the save row.
 * Returns { element, destroy }.
 */
export function createSaveForm({ detectedLabel, currentFieldValue, onSave, onCancel }) {
  const form = document.createElement('div');
  form.className = 'pesto-save-form';

  // Question field
  const qLabel = document.createElement('label');
  qLabel.textContent = 'Question';
  form.appendChild(qLabel);

  const qInput = document.createElement('input');
  qInput.type = 'text';
  qInput.value = detectedLabel || '';
  qInput.placeholder = 'e.g., Full name';
  form.appendChild(qInput);

  // Answer field
  const aLabel = document.createElement('label');
  aLabel.textContent = 'Answer';
  form.appendChild(aLabel);

  const aTextarea = document.createElement('textarea');
  aTextarea.value = currentFieldValue || '';
  aTextarea.placeholder = 'Type your answer...';
  aTextarea.rows = 3;
  form.appendChild(aTextarea);

  // Character count
  const charCount = document.createElement('div');
  charCount.className = 'pesto-char-count';
  updateCharCount(charCount, aTextarea.value.length);
  form.appendChild(charCount);

  aTextarea.addEventListener('input', () => {
    updateCharCount(charCount, aTextarea.value.length);
    updateSaveButtonState();
  });

  // Error display
  const errorEl = document.createElement('div');
  errorEl.className = 'pesto-save-error';
  errorEl.style.display = 'none';
  form.appendChild(errorEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'pesto-save-form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pesto-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  });
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'pesto-btn-save';
  saveBtn.textContent = 'Save';
  saveBtn.type = 'button';
  saveBtn.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const question = qInput.value.trim();
    const answer = aTextarea.value.trim();

    if (!question) {
      showError('Question is required.');
      return;
    }
    if (!answer) {
      showError('Answer is required.');
      return;
    }
    if (answer.length > ANSWER_CHAR_LIMIT) {
      showError(`Answer exceeds ${ANSWER_CHAR_LIMIT} character limit.`);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    errorEl.style.display = 'none';

    try {
      await onSave({ question, answer });
    } catch (err) {
      showError(err.message || 'Failed to save. Try again.');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function updateSaveButtonState() {
    const answer = aTextarea.value.trim();
    saveBtn.disabled = answer.length > ANSWER_CHAR_LIMIT;
  }

  // Prevent focus loss from closing the dropdown
  form.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  return {
    element: form,
    destroy: () => form.remove(),
  };
}

function updateCharCount(el, length) {
  el.textContent = `${length} / ${ANSWER_CHAR_LIMIT}`;

  el.classList.remove('warn', 'error');
  if (length > ANSWER_CHAR_LIMIT) {
    el.classList.add('error');
  } else if (length > ANSWER_WARN_LIMIT) {
    el.classList.add('warn');
  }
}
