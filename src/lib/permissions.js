/**
 * Permission management helpers.
 * chrome.permissions.request MUST be called from a user gesture context
 * (popup, onboarding page click handler), not from the service worker.
 * These helpers are intended for use in popup.js and onboarding.js.
 */

/**
 * Request <all_urls> permission (for Mode 1).
 * Must be called from a click handler in popup/onboarding.
 */
export async function requestAllUrls() {
  try {
    return await chrome.permissions.request({ origins: ['<all_urls>'] });
  } catch (err) {
    console.error('Failed to request <all_urls>:', err);
    return false;
  }
}

/**
 * Remove <all_urls> permission.
 */
export async function removeAllUrls() {
  try {
    return await chrome.permissions.remove({ origins: ['<all_urls>'] });
  } catch (err) {
    console.error('Failed to remove <all_urls>:', err);
    return false;
  }
}

/**
 * Request permission for a specific domain.
 * Must be called from a click handler in popup/onboarding.
 */
export async function requestOrigin(domain) {
  const pattern = normalizeToPattern(domain);
  if (!pattern) return false;

  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch (err) {
    console.error(`Failed to request origin ${pattern}:`, err);
    return false;
  }
}

/**
 * Request permissions for multiple patterns at once.
 * Must be called from a click handler.
 */
export async function requestOrigins(patterns) {
  if (!patterns || patterns.length === 0) return false;

  try {
    return await chrome.permissions.request({ origins: patterns });
  } catch (err) {
    console.error('Failed to request origins:', err);
    return false;
  }
}

/**
 * Remove permission for a specific domain.
 */
export async function removeOrigin(domain) {
  const pattern = normalizeToPattern(domain);
  if (!pattern) return false;

  try {
    return await chrome.permissions.remove({ origins: [pattern] });
  } catch (err) {
    console.error(`Failed to remove origin ${pattern}:`, err);
    return false;
  }
}

/**
 * Check if a specific permission is granted.
 */
export async function checkPermission(pattern) {
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/**
 * Normalize a domain or URL input to a Chrome match pattern.
 * Returns null if the input is invalid (IP, localhost, etc.).
 *
 * Examples:
 *   "greenhouse.io" -> "https://*.greenhouse.io/*"
 *   "https://boards.greenhouse.io/stripe/jobs/123" -> "https://*.greenhouse.io/*"
 *   "www.linkedin.com" -> "https://*.linkedin.com/*"
 */
export function normalizeToPattern(input) {
  if (!input) return null;

  let host = input.trim();

  // Extract hostname from URL
  try {
    if (host.includes('://')) {
      const url = new URL(host);
      host = url.hostname;
    } else if (host.includes('/')) {
      // Domain with path
      host = host.split('/')[0];
    }
  } catch {
    // Not a valid URL; treat as bare domain
  }

  // Strip www. prefix
  host = host.replace(/^www\./, '');

  // Strip port
  host = host.split(':')[0];

  // Lowercase
  host = host.toLowerCase();

  // Reject IPs
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return null;

  // Reject localhost
  if (host === 'localhost' || host === '127.0.0.1') return null;

  // Reject bare TLDs or empty
  if (!host || !host.includes('.')) return null;

  return `https://*.${host}/*`;
}

/**
 * Check if a domain is a common top-level domain that would be overly broad.
 */
export function isBroadDomain(domain) {
  const broad = new Set([
    'google.com', 'amazon.com', 'facebook.com', 'apple.com',
    'microsoft.com', 'twitter.com', 'youtube.com', 'instagram.com',
    'reddit.com', 'github.com', 'gmail.com',
  ]);
  const normalized = domain.replace(/^www\./, '').toLowerCase();
  return broad.has(normalized);
}
