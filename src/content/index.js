import { MSG_MATCH_FIELD, MSG_SAVE_ANSWER, MSG_DELETE_OPTION, MSG_ARCHIVE_ROW, MSG_UPDATE_RECENTS } from '../lib/constants.js';
import { extractLabel } from './label-extractor.js';
import { isTextInput, shouldSuppress, observeDynamicInputs } from './field-detector.js';
import { getPMOffset } from './pm-detector.js';
import { insertText } from './inserter.js';
import { initShadowHost, getShadowRoot, clearShadowContent } from './ui/shadow-host.js';
import { createDropdownButton } from './ui/dropdown-button.js';
import { createDropdownMenu } from './ui/dropdown-menu.js';
import { showTooltip, hideTooltip } from './ui/tooltip.js';
import { showToast } from './ui/toast.js';
import { showConfirmDialog } from './ui/confirm-dialog.js';

// Guard against double-initialization
if (!window.__pesto_initialized) {
  window.__pesto_initialized = true;
  initPesto();
}

function initPesto() {
  let shadowRoot = null;
  let currentButton = null;
  let currentMenu = null;
  let currentInputEl = null;
  let currentLabel = null;
  let currentMatches = null;
  let currentMatchError = null; // null | 'reload' | string error message
  let isMenuOpen = false;
  let mouseDownOnPesto = false;
  let debounceTimer = null;

  // Initialize shadow host
  try {
    shadowRoot = initShadowHost();
  } catch (err) {
    console.error('Pesto: Failed to initialize shadow host:', err);
    return;
  }

  // --- Focus handler ---
  document.addEventListener('focusin', (e) => {
    const target = e.target;

    if (!isTextInput(target)) return;
    if (shouldSuppress(target)) return;

    // If focusing the same input, don't reinitialize
    if (target === currentInputEl && currentButton) return;

    // Tear down previous
    teardown();

    currentInputEl = target;
    currentLabel = extractLabel(target);
    const pmOffset = getPMOffset(target);

    // Create the dropdown button
    currentButton = createDropdownButton({
      onToggle: (open) => {
        if (open) {
          openMenu();
        } else {
          closeMenu();
        }
      },
    });

    currentButton.updatePosition(currentInputEl, pmOffset);
    shadowRoot.appendChild(currentButton.element);

    // Debounce match request, then auto-open menu
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (currentLabel) {
        await requestMatches(currentLabel);
      } else {
        currentMatches = [];
      }
      // Auto-open the menu after matches are fetched
      if (currentButton && currentInputEl) {
        currentButton.setOpen(true);
        openMenu();
      }
    }, 100);
  });

  // --- Blur handler ---
  document.addEventListener('focusout', (e) => {
    // Don't close if the user is interacting with Pesto elements
    if (mouseDownOnPesto) return;

    // Delay to allow mousedown events on shadow elements to fire first
    setTimeout(() => {
      if (mouseDownOnPesto) {
        mouseDownOnPesto = false;
        return;
      }

      // Check if focus moved to another input (focusin will handle it)
      const active = document.activeElement;
      if (active && isTextInput(active) && active !== currentInputEl) {
        return; // focusin handler will take over
      }

      // If focus is still on the same input (e.g., after clicking Pesto),
      // don't tear down
      if (active === currentInputEl) return;

      teardown();
    }, 150);
  });

  // Global mousedown tracker to detect clicks on Pesto shadow elements
  // This must be on the shadow root, not the document
  shadowRoot.addEventListener('mousedown', () => {
    mouseDownOnPesto = true;
    setTimeout(() => { mouseDownOnPesto = false; }, 300);
  });

  // --- Scroll handler: close menu on scroll ---
  function onScrollCloseMenu() {
    if (isMenuOpen) {
      closeMenu();
      if (currentButton) {
        currentButton.setOpen(false);
      }
    }
  }
  window.addEventListener('scroll', onScrollCloseMenu, true);

  // Observe dynamically added inputs (SPAs, multi-step forms)
  observeDynamicInputs(() => {
    // No action needed on add — focusin handles activation
  });

  // --- Core functions ---

  async function requestMatches(label) {
    currentMatchError = null;

    // Detect invalidated context before even trying to message
    if (!chrome.runtime?.id) {
      currentMatchError = 'reload';
      currentMatches = [];
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_MATCH_FIELD,
        label,
      });

      if (response?.error) {
        currentMatchError = response.error;
        currentMatches = [];
        return;
      }

      currentMatches = response?.matches || [];
    } catch (err) {
      currentMatchError = err.message?.includes('Extension context invalidated')
        ? 'reload'
        : (err.message || 'Failed to load suggestions');
      currentMatches = [];
    }
  }

  function openMenu() {
    if (isMenuOpen || !currentInputEl) return;

    // Close any existing menu first (this resets isMenuOpen to false)
    closeMenu(true);

    isMenuOpen = true;

    currentMenu = createDropdownMenu({
      matches: currentMatches || [],
      matchError: currentMatchError,
      detectedLabel: currentLabel,
      inputEl: currentInputEl,
      onSaveClick: () => handleImmediateSave(),
      onOptionClick: ({ optionText, questionName }) => {
        insertText(currentInputEl, optionText);
        closeMenu();
        // Update recents
        try {
          chrome.runtime.sendMessage({
            type: MSG_UPDATE_RECENTS,
            question: questionName,
            option: optionText,
          });
        } catch { /* ignore */ }
      },
      onDeleteClick: ({ pageId, optionIndex, optionText, questionName }) => {
        handleDelete({ pageId, optionIndex, optionText, questionName });
      },
      onOptionHover: ({ optionText, rowRect, textEl }) => {
        // Only show tooltip if the text is truncated (overflows visible area)
        if (textEl && textEl.scrollWidth > textEl.clientWidth) {
          showTooltip(shadowRoot, { optionText, rowRect });
        }
      },
      onOptionHoverEnd: () => {
        hideTooltip();
      },
    });

    shadowRoot.appendChild(currentMenu.element);
    // Reposition now that the menu is in the DOM and has a real height
    currentMenu.updatePosition();
    currentButton?.setOpen(true);
  }

  function closeMenu(keepButton = false) {
    hideTooltip();

    if (currentMenu) {
      currentMenu.destroy();
      currentMenu = null;
    }

    isMenuOpen = false;

    if (!keepButton && currentButton) {
      currentButton.setOpen(false);
    }
  }

  async function handleImmediateSave() {
    const question = currentLabel || '';
    const answer = currentInputEl?.value || '';

    if (!question.trim() || !answer.trim()) {
      showToast(shadowRoot, 'Nothing to save — field is empty.');
      return;
    }

    // Immediately show "Saved" state in the menu
    if (currentMenu) {
      currentMenu.showSaved();
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_SAVE_ANSWER,
        question: question.trim(),
        answer: answer.trim(),
      });

      if (response?.error) {
        showToast(shadowRoot, `Error: ${response.error}`);
        return;
      }

      // Build toast message
      let toastMessage;
      if (response.action === 'merged') {
        toastMessage = `Added as option ${response.optionNumber} to '${response.questionName}'.`;
      } else if (response.action === 'created_fallback') {
        toastMessage = `Saved as a new question.`;
      } else {
        toastMessage = `Saved '${response.questionName}'.`;
      }

      // Show toast with undo button
      showToast(shadowRoot, toastMessage, {
        onUndo: () => undoSave(response),
      });

      // Refresh matches
      if (currentLabel) {
        await requestMatches(currentLabel);
      }

      // Close menu after brief delay so user sees "Saved"
      setTimeout(() => closeMenu(), 800);

    } catch (err) {
      const isInvalid = !chrome.runtime?.id ||
        err.message?.includes('Extension context invalidated');
      if (isInvalid) {
        showToast(shadowRoot, 'Pesto was reloaded — please refresh this page to continue.');
      } else {
        showToast(shadowRoot, `Error: ${err.message || 'Failed to save.'}`);
      }
    }
  }

  async function undoSave(saveResponse) {
    try {
      if (!saveResponse?.pageId) {
        showToast(shadowRoot, 'Could not undo.');
        return;
      }

      if (saveResponse.action === 'merged') {
        // Remove the last option we appended
        await chrome.runtime.sendMessage({
          type: MSG_DELETE_OPTION,
          pageId: saveResponse.pageId,
          optionIndex: saveResponse.optionCount - 1,
        });
      } else {
        // Archive the newly created page
        await chrome.runtime.sendMessage({
          type: MSG_ARCHIVE_ROW,
          pageId: saveResponse.pageId,
        });
      }

      showToast(shadowRoot, 'Save undone.');

      // Refresh matches
      if (currentLabel) {
        await requestMatches(currentLabel);
      }
    } catch (err) {
      showToast(shadowRoot, `Undo failed: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleDelete({ pageId, optionIndex, optionText, questionName }) {
    const confirmed = await showConfirmDialog(shadowRoot, {
      questionName,
      optionIndex,
      optionText,
    });

    if (!confirmed) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG_DELETE_OPTION,
        pageId,
        optionIndex,
      });

      if (response?.error) {
        showToast(shadowRoot, `Error: ${response.error}`);
        return;
      }

      let toastMessage;
      if (response.action === 'archived') {
        toastMessage = `'${questionName}' moved to Notion trash.`;
      } else {
        toastMessage = `Option deleted from '${questionName}'. ${response.remainingOptions} option(s) remaining.`;
      }
      showToast(shadowRoot, toastMessage);

      // Refresh matches and reopen menu
      if (currentLabel) {
        await requestMatches(currentLabel);
      }
      closeMenu(true);
      if (currentButton) {
        currentButton.setOpen(true);
      }
      openMenu();
    } catch (err) {
      showToast(shadowRoot, `Error: ${err.message || 'Failed to delete.'}`);
    }
  }

  function teardown() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    closeMenu();

    if (currentButton) {
      currentButton.destroy();
      currentButton = null;
    }

    currentInputEl = null;
    currentLabel = null;
    currentMatches = null;
    currentMatchError = null;
  }
}
