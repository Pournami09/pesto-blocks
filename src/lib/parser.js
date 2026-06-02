/**
 * Parse answer variants from an Answer cell.
 * Variants are separated by "---" on its own line.
 * Notion auto-converts "---" to em dash "—" or mixed forms like "—-",
 * so we match any line consisting only of hyphens, em dashes, or en dashes (1+).
 * If no separator is found, the whole cell is one option.
 */
export function parseOptions(answerText) {
  if (!answerText || !answerText.trim()) return [];

  // Normalize line endings
  const text = answerText.replace(/\r\n/g, '\n');

  // Split on a line that is only dashes/em-dashes/en-dashes
  // Handles: "---", "—", "—-", "–", and any mix Notion produces
  const parts = text.split(/\n[ \t]*[-–—][-–—\s]*\n/);

  // Trim and filter empty
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Serialize an array of option strings into ---‑separated format.
 */
export function serializeOptions(options) {
  return options
    .filter((o) => o && o.trim())
    .map((o) => o.trim())
    .join('\n---\n');
}

/**
 * Split a Question cell into its canonical name and aliases.
 * Delimiter: " | " (pipe with surrounding spaces).
 * Returns { canonical: string, aliases: string[] } where aliases includes the canonical.
 */
export function splitAliases(questionText) {
  if (!questionText) return { canonical: '', aliases: [] };

  const segments = questionText
    .split(' | ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) return { canonical: '', aliases: [] };

  return {
    canonical: segments[0],
    aliases: segments,
  };
}

/**
 * Normalize a label for matching: lowercase, strip common form artifacts,
 * collapse whitespace, trim.
 */
export function normalizeLabel(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/\*+/g, '')                 // strip asterisks (required markers)
    .replace(/\(required\)/gi, '')       // strip "(required)"
    .replace(/\(optional\)/gi, '')       // strip "(optional)"
    .replace(/:\s*$/, '')                // strip trailing colon
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}
