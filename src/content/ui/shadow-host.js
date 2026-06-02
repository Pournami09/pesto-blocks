import { PESTO_STYLES } from './styles.js';

let shadowRoot = null;
let hostElement = null;

/**
 * Initialize the shadow DOM host. Returns the shadow root for rendering.
 * Uses a closed shadow root to prevent host page JS from accessing internals.
 */
export function initShadowHost() {
  if (shadowRoot) return shadowRoot;

  hostElement = document.createElement('div');
  hostElement.id = '__pesto-shadow-host';
  // Ensure host element doesn't interfere with page layout
  hostElement.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';

  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = PESTO_STYLES;
  shadowRoot.appendChild(style);

  document.body.appendChild(hostElement);

  return shadowRoot;
}

/**
 * Get the existing shadow root, or null if not initialized.
 */
export function getShadowRoot() {
  return shadowRoot;
}

/**
 * Remove all children from the shadow root except the <style> element.
 */
export function clearShadowContent() {
  if (!shadowRoot) return;
  const children = Array.from(shadowRoot.children);
  for (const child of children) {
    if (child.tagName !== 'STYLE') {
      child.remove();
    }
  }
}

/**
 * Tear down the shadow host completely.
 */
export function destroyShadowHost() {
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
    shadowRoot = null;
  }
}
