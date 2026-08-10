/**
 * Generic/placeholder labels used by form builders instead of real field names.
 * Google Forms uses aria-label="Your answer" on every short-answer field;
 * the actual question title lives in a sibling heading element.
 * When one of these is detected we fall back to findQuestionHeading().
 */
const GENERIC_LABELS = new Set([
  'your answer',
  'short answer',
  'long answer',
  'paragraph',
  'your response',
  'enter your answer',
  'type your answer',
  'write your answer',
  'this field',
  'enter this field',
  'answer',
]);

function isGenericLabel(text) {
  if (!text) return false;
  return GENERIC_LABELS.has(text.toLowerCase().trim());
}

/**
 * For form builders that put the question title in a heading element that is
 * a sibling (or ancestor-sibling) of the input's container — rather than
 * wiring it up via aria-labelledby or <label for> — climb up the DOM and
 * scan previous siblings for the nearest [role="heading"] or <h1-h6>.
 * Stops at <form>, <body>, or after 10 levels.
 */
function findQuestionHeading(inputEl) {
  let node = inputEl;

  for (let depth = 0; depth < 10; depth++) {
    node = node.parentElement;
    if (!node || node === document.body || node.tagName === 'FORM') break;

    let sibling = node.previousElementSibling;
    while (sibling) {
      // Skip invisible siblings
      if (sibling.offsetParent === null && sibling.tagName !== 'BODY') {
        sibling = sibling.previousElementSibling;
        continue;
      }

      // Heading selector — covers ARIA and native heading tags
      const HEADING_SEL = '[role="heading"], h1, h2, h3, h4, h5, h6';

      // The sibling itself might be the heading
      const headingEl = sibling.matches(HEADING_SEL)
        ? sibling
        : sibling.querySelector(HEADING_SEL);

      if (headingEl) {
        const text = cleanLabel(headingEl.textContent);
        if (text && text.length >= 2) return text;
      }

      sibling = sibling.previousElementSibling;
    }
  }

  return null;
}

/**
 * Extract a label for a text input element using a 7-tier priority system,
 * with an automatic fallback for form-builder generic labels (Tier 8).
 * Returns a cleaned label string or null if no label can be found.
 */
export function extractLabel(inputEl) {
  const label = extractLabelDirect(inputEl);

  // Tier 8: if the standard tiers returned a generic form-builder placeholder
  // (e.g. Google Forms aria-label="Your answer"), look for the actual question
  // title in the surrounding heading structure instead.
  if (label && isGenericLabel(label)) {
    return findQuestionHeading(inputEl) ?? label;
  }

  return label;
}

/**
 * Internal: run tiers 1–7 and return the first match found.
 */
function extractLabelDirect(inputEl) {
  // Tier 1: aria-label
  const ariaLabel = inputEl.getAttribute('aria-label');
  if (ariaLabel?.trim()) return cleanLabel(ariaLabel);

  // Tier 2: aria-labelledby -> referenced element text
  const labelledBy = inputEl.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const texts = ids
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (texts.length > 0) return cleanLabel(texts.join(' '));
  }

  // Tier 3: <label for="id">
  const id = inputEl.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent?.trim()) return cleanLabel(label.textContent);
  }

  // Tier 4: wrapping <label> ancestor
  const wrappingLabel = inputEl.closest('label');
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true);
    // Remove input elements so we only get the label text
    clone.querySelectorAll('input, textarea, select, button').forEach((el) => el.remove());
    const text = clone.textContent?.trim();
    if (text) return cleanLabel(text);
  }

  // Tier 5: placeholder
  const placeholder = inputEl.getAttribute('placeholder');
  if (placeholder?.trim()) return cleanLabel(placeholder);

  // Tier 6: nearest preceding visible text
  const preceding = findPrecedingText(inputEl);
  if (preceding) return cleanLabel(preceding);

  // Tier 7: name/id attribute, de-camel/snake-cased
  const name = inputEl.getAttribute('name') || inputEl.id;
  if (name) return cleanLabel(deCamelSnake(name));

  return null;
}

/**
 * Clean a raw label: lowercase, strip form artifacts, collapse whitespace, trim.
 */
export function cleanLabel(text) {
  if (!text) return '';

  let cleaned = text
    .replace(/\*+/g, '')
    .replace(/\(required\)/gi, '')
    .replace(/\(optional\)/gi, '')
    .replace(/:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Cap at 100 characters
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }

  return cleaned;
}

/**
 * Convert camelCase, snake_case, kebab-case identifiers to space-separated words.
 */
export function deCamelSnake(str) {
  return str
    // Insert space before uppercase letters (camelCase)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Replace underscores and hyphens with spaces
    .replace(/[_-]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Walk backward through the DOM from the input to find the nearest preceding
 * visible text that could be a label. Stops after 3 attempts or at a
 * structural boundary.
 */
function findPrecedingText(inputEl) {
  const structuralTags = new Set([
    'DIV', 'SECTION', 'FORM', 'FIELDSET', 'TABLE', 'TR', 'UL', 'OL',
    'HEADER', 'FOOTER', 'NAV', 'MAIN', 'ARTICLE', 'ASIDE',
  ]);

  let node = inputEl;
  let attempts = 0;

  while (attempts < 5) {
    // Try previous sibling
    let sibling = node.previousElementSibling;
    while (sibling && attempts < 5) {
      attempts++;

      // Skip hidden elements
      if (sibling.offsetParent === null && sibling.tagName !== 'BODY') {
        sibling = sibling.previousElementSibling;
        continue;
      }

      // Stop at structural boundaries
      if (structuralTags.has(sibling.tagName)) break;

      // Check for label-like elements
      const tag = sibling.tagName;
      if (tag === 'LABEL' || tag === 'SPAN' || tag === 'P' ||
          tag === 'H1' || tag === 'H2' || tag === 'H3' ||
          tag === 'H4' || tag === 'H5' || tag === 'H6' ||
          tag === 'LEGEND' || tag === 'STRONG' || tag === 'EM') {
        const text = sibling.textContent?.trim();
        if (text && text.length <= 100) return text;
      }

      sibling = sibling.previousElementSibling;
    }

    // Move up to parent and try its previous siblings
    node = node.parentElement;
    if (!node || structuralTags.has(node.tagName) || node === document.body) break;
    attempts++;
  }

  return null;
}
