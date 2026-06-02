export const PESTO_STYLES = `
  :host {
    --pesto-green: #538700;
    --pesto-green-hover: #457100;
    --pesto-green-pale: #ebf3dd;
    --pesto-surface: #ffffff;
    --pesto-tooltip-bg: #0e0e0e;
    --pesto-text-strong: #2c2c2b;
    --pesto-text-weak: #73726e;
    --pesto-text-muted: #7e7a76;
    --pesto-tooltip-text: #ffffff;
    --pesto-radius-base: 6px;
    --pesto-radius-dialog: 10px;
    --pesto-radius-button-corner: 5px;
    --pesto-spacer-200: 4px;
    --pesto-spacer-600: 12px;
    --pesto-shadow-dialog: 0px 0px 0px 1px rgba(84,72,49,0.08),
                           0px 2px 4px -1px rgba(0,0,0,0.06),
                           0px 14px 28px -6px rgba(0,0,0,0.1);
    --pesto-destructive-red: #D44C47;
    --pesto-font: 'SF Pro Text', -apple-system, BlinkMacSystemFont,
                  'Segoe UI', system-ui, sans-serif;

    all: initial;
    font-family: var(--pesto-font);
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Dropdown button */
  .pesto-btn {
    position: fixed;
    pointer-events: auto;
    display: flex;
    align-items: center;
    cursor: pointer;
    z-index: 2147483647;
    user-select: none;
    height: 20px;
    border: none;
    background: none;
    padding: 0;
    gap: 0;
  }

  .pesto-btn-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pesto-green-pale);
    padding: 3px;
    border-radius: var(--pesto-radius-button-corner) 0 0 var(--pesto-radius-button-corner);
    height: 20px;
    width: 20px;
  }

  .pesto-btn-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pesto-green);
    padding: 3px;
    border-radius: 0 var(--pesto-radius-button-corner) var(--pesto-radius-button-corner) 0;
    height: 20px;
    width: 20px;
    transition: background-color 0.15s ease;
  }

  .pesto-btn:hover .pesto-btn-chevron,
  .pesto-btn.open .pesto-btn-chevron {
    background: var(--pesto-green-hover);
  }

  .pesto-btn:hover .pesto-btn-logo svg rect,
  .pesto-btn.open .pesto-btn-logo svg rect {
    fill: var(--pesto-green-hover);
  }

  .pesto-btn-chevron svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: white;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.2s ease;
    transform: rotate(-90deg);
  }

  .pesto-btn.open .pesto-btn-chevron svg {
    transform: rotate(0deg);
  }

  /* Dropdown menu */
  .pesto-menu {
    position: fixed;
    pointer-events: auto;
    background: var(--pesto-surface);
    border-radius: var(--pesto-radius-dialog);
    box-shadow: var(--pesto-shadow-dialog);
    padding: var(--pesto-spacer-200);
    z-index: 2147483647;
    max-height: 320px;
    overflow-y: auto;
    font-family: var(--pesto-font);
  }

  .pesto-menu::-webkit-scrollbar {
    width: 6px;
  }
  .pesto-menu::-webkit-scrollbar-track {
    background: transparent;
  }
  .pesto-menu::-webkit-scrollbar-thumb {
    background: #d4d4d4;
    border-radius: 3px;
  }

  /* Save row */
  .pesto-save-row {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 4px 8px 5px 8px;
    gap: 7px;
    border-radius: var(--pesto-radius-base);
    cursor: pointer;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: -0.04em;
    color: var(--pesto-text-strong);
    user-select: none;
  }

  .pesto-save-row:hover {
    background: #f5f5f4;
  }

  .pesto-save-row .pesto-icon-container {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pesto-save-row .pesto-icon-container svg {
    width: 14px;
    height: 14px;
    stroke: var(--pesto-text-strong);
    stroke-width: 2;
    fill: none;
  }

  /* Recents label */
  .pesto-recents-label {
    padding: 5px var(--pesto-spacer-600) 2px var(--pesto-spacer-600);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: var(--pesto-text-muted);
    user-select: none;
  }

  /* Option row */
  .pesto-option-row {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 4px 8px 5px 8px;
    gap: 7px;
    border-radius: var(--pesto-radius-base);
    cursor: pointer;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: -0.04em;
    color: var(--pesto-text-weak);
    user-select: none;
  }

  .pesto-option-row:hover {
    background: #f5f5f4;
  }

  .pesto-option-row .pesto-pencil-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.4;
  }

  .pesto-option-row .pesto-pencil-icon svg {
    width: 14px;
    height: 14px;
    stroke: var(--pesto-text-weak);
    stroke-width: 2;
    fill: none;
  }

  .pesto-option-text {
    flex: 1 1 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .pesto-option-actions {
    display: none;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .pesto-option-row:hover .pesto-option-actions {
    display: flex;
  }

  .pesto-action-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
  }

  .pesto-action-icon:hover {
    background: #ebebea;
  }

  .pesto-action-icon svg {
    width: 14px;
    height: 14px;
    stroke: var(--pesto-text-weak);
    stroke-width: 2;
    fill: none;
  }

  .pesto-action-icon.pesto-trash:hover svg {
    stroke: var(--pesto-destructive-red);
  }

  /* Empty state */
  .pesto-empty-state {
    padding: 8px 12px;
    font-size: 13px;
    line-height: 18px;
    color: var(--pesto-text-muted);
    font-style: italic;
  }

  /* Tooltip */
  .pesto-tooltip {
    position: fixed;
    pointer-events: none;
    background: var(--pesto-tooltip-bg);
    color: var(--pesto-tooltip-text);
    border-radius: var(--pesto-radius-base);
    padding: 8px 9px;
    width: 318px;
    font-family: var(--pesto-font);
    font-size: 12px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: -0.04em;
    word-break: break-word;
    white-space: pre-wrap;
    z-index: 2147483647;
  }

  /* Save form */
  .pesto-save-form {
    padding: 8px;
    border-top: 1px solid #ebebea;
  }

  .pesto-save-form label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--pesto-text-muted);
    margin-bottom: 4px;
    letter-spacing: -0.04em;
  }

  .pesto-save-form input,
  .pesto-save-form textarea {
    width: 100%;
    border: 1px solid #d4d4d4;
    border-radius: var(--pesto-radius-base);
    padding: 6px 8px;
    font-family: var(--pesto-font);
    font-size: 14px;
    line-height: 20px;
    color: var(--pesto-text-strong);
    outline: none;
    resize: vertical;
    margin-bottom: 8px;
  }

  .pesto-save-form input:focus,
  .pesto-save-form textarea:focus {
    border-color: var(--pesto-green);
    box-shadow: 0 0 0 2px rgba(83,135,0,0.15);
  }

  .pesto-save-form textarea {
    min-height: 60px;
    max-height: 120px;
  }

  .pesto-char-count {
    font-size: 11px;
    color: var(--pesto-text-muted);
    text-align: right;
    margin-top: -4px;
    margin-bottom: 6px;
  }

  .pesto-char-count.warn {
    color: #e8a300;
  }

  .pesto-char-count.error {
    color: var(--pesto-destructive-red);
  }

  .pesto-save-form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .pesto-btn-save,
  .pesto-btn-cancel {
    padding: 4px 12px;
    border-radius: var(--pesto-radius-base);
    font-family: var(--pesto-font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    line-height: 20px;
  }

  .pesto-btn-save {
    background: var(--pesto-green);
    color: #ffffff;
    border-color: var(--pesto-green);
  }

  .pesto-btn-save:hover {
    background: var(--pesto-green-hover);
    border-color: var(--pesto-green-hover);
  }

  .pesto-btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pesto-btn-cancel {
    background: transparent;
    color: var(--pesto-text-weak);
    border-color: #d4d4d4;
  }

  .pesto-btn-cancel:hover {
    background: #f5f5f4;
  }

  .pesto-save-error {
    font-size: 12px;
    color: var(--pesto-destructive-red);
    margin-bottom: 6px;
  }

  /* Toast */
  .pesto-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: auto;
    background: var(--pesto-tooltip-bg);
    color: var(--pesto-tooltip-text);
    border-radius: var(--pesto-radius-base);
    padding: 10px 16px;
    font-family: var(--pesto-font);
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    letter-spacing: -0.04em;
    z-index: 2147483647;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .pesto-toast.visible {
    opacity: 1;
  }

  .pesto-toast-undo {
    margin-left: 12px;
    padding: 2px 8px;
    background: transparent;
    color: var(--pesto-green-pale);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    font-family: var(--pesto-font);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    pointer-events: auto;
  }

  .pesto-toast-undo:hover {
    background: rgba(255,255,255,0.1);
  }

  /* Confirm dialog */
  .pesto-confirm-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.3);
    pointer-events: auto;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pesto-confirm-dialog {
    background: var(--pesto-surface);
    border-radius: var(--pesto-radius-dialog);
    box-shadow: var(--pesto-shadow-dialog);
    padding: 20px;
    max-width: 380px;
    width: 90%;
    font-family: var(--pesto-font);
  }

  .pesto-confirm-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--pesto-text-strong);
    margin-bottom: 8px;
  }

  .pesto-confirm-body {
    font-size: 13px;
    line-height: 18px;
    color: var(--pesto-text-weak);
    margin-bottom: 16px;
  }

  .pesto-confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .pesto-btn-confirm-delete {
    padding: 6px 14px;
    border-radius: var(--pesto-radius-base);
    font-family: var(--pesto-font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--pesto-destructive-red);
    background: var(--pesto-destructive-red);
    color: #ffffff;
    line-height: 20px;
  }

  .pesto-btn-confirm-delete:hover {
    opacity: 0.9;
  }

  .pesto-btn-confirm-cancel {
    padding: 6px 14px;
    border-radius: var(--pesto-radius-base);
    font-family: var(--pesto-font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #d4d4d4;
    background: transparent;
    color: var(--pesto-text-weak);
    line-height: 20px;
  }

  .pesto-btn-confirm-cancel:hover {
    background: #f5f5f4;
  }
`;
