import {
  MSG_MATCH_FIELD, MSG_SAVE_ANSWER, MSG_DELETE_OPTION, MSG_ARCHIVE_ROW,
  MSG_GET_CONNECTION_STATUS, MSG_UPDATE_RECENTS,
  MSG_TEST_CONNECTION, MSG_SET_TOKEN, MSG_SET_DATABASE, MSG_CREATE_DATABASE,
  MSG_SEARCH_PAGES, MSG_SET_TRIGGER_MODE, MSG_GET_RECENTS,
  MSG_ADD_SITE, MSG_REMOVE_SITE, MSG_REFRESH_CACHE, MSG_CLEAR_CACHE,
  MSG_LOCK, MSG_GET_STATE, MSG_ARM_TAB, MSG_REGISTER_SCRIPTS,
  MSG_PIN_RECENT, MSG_UNPIN_RECENT, MSG_DISMISS_RECENT,
  MSG_SEARCH_DATABASES, MSG_SWITCH_DATABASE,
  STORAGE_TOKEN, STORAGE_DB_ID, STORAGE_DB_NAME,
  STORAGE_TRIGGER_MODE, STORAGE_ALLOWLIST, STORAGE_RECENTS, STORAGE_ARMED_TABS,
  STORAGE_PINNED, STORAGE_DB_PARENT,
  MODE_AUTO_ALL, MODE_AUTO_ALLOWLIST, MODE_CLICK_TO_ARM,
  MERGE_THRESHOLD, ANSWER_CHAR_LIMIT, MAX_RECENTS,
  ALARM_CACHE_TTL,
} from './lib/constants.js';

import {
  queryAllRows, createPage, updatePageAnswer, archivePage,
  createDatabase as notionCreateDatabase, searchPages as notionSearchPages,
  searchDatabases as notionSearchDatabases,
  testConnection as notionTestConnection, extractDbId,
} from './lib/notion-api.js';

import { getOrFetch, clearCache as clearCacheData, setCachedData } from './lib/cache.js';
import { findMatches, buildIndex } from './lib/matcher.js';
import { parseOptions, serializeOptions, normalizeLabel } from './lib/parser.js';

// ---------------------------------------------------------------------------
// Top-level event listeners (registered synchronously per MV3 requirement)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('Pesto SW error:', err);
      sendResponse({ error: err.message || 'Unknown error' });
    });
  return true; // keep channel open for async response
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
  chrome.alarms.create(ALARM_CACHE_TTL, { periodInMinutes: 10 });
  initializeTriggerMode();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_CACHE_TTL) {
    // Cache is checked on access; alarm just ensures the TTL is enforced
    // even if no messages arrive. No-op here — staleness is checked in getOrFetch.
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Clean up armed tabs (Mode 3)
  try {
    const { [STORAGE_ARMED_TABS]: armed = [] } = await chrome.storage.local.get(STORAGE_ARMED_TABS);
    if (armed.includes(tabId)) {
      await chrome.storage.local.set({
        [STORAGE_ARMED_TABS]: armed.filter((id) => id !== tabId),
      });
    }
  } catch { /* ignore */ }
});

chrome.permissions.onRemoved.addListener(async (permissions) => {
  if (!permissions.origins || permissions.origins.length === 0) return;
  try {
    const { [STORAGE_ALLOWLIST]: allowlist = [] } = await chrome.storage.local.get(STORAGE_ALLOWLIST);
    const updated = allowlist.map((site) => {
      const revoked = permissions.origins.some((o) =>
        site.patterns.includes(o)
      );
      return revoked ? { ...site, status: 'revoked' } : site;
    });
    await chrome.storage.local.set({ [STORAGE_ALLOWLIST]: updated });
  } catch { /* ignore */ }
});

// On startup, re-register content scripts for the current trigger mode
chrome.runtime.onStartup.addListener(() => {
  initializeTriggerMode();
});

// ---------------------------------------------------------------------------
// Popup keepalive
// ---------------------------------------------------------------------------
// MV3 service workers terminate after ~30s of inactivity. When the popup was
// a default_popup, Chrome kept the SW alive automatically. Now that the popup
// runs in a widget iframe, popup.js explicitly connects a port so the SW
// stays alive for the duration of the session, preventing in-flight Notion
// API fetch() calls from being aborted mid-request ("Failed to fetch").
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pesto-popup') return;
  // Holding the port reference is sufficient — the SW stays alive while
  // any port is connected. Nothing else needed here.
  port.onDisconnect.addListener(() => { /* popup closed; SW may sleep */ });
});

// ---------------------------------------------------------------------------
// Widget toggle — inject widget.js into the active tab on icon click
// ---------------------------------------------------------------------------
// With no default_popup, clicking the extension icon fires onClicked.
// We inject a script that creates a <pesto-widget> custom element with
// Shadow DOM + iframe, giving full CSS control (border-radius, shadow, etc.).

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['widget.js'],
    });
  } catch (err) {
    console.error('Pesto: could not inject widget into this tab:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCredentials() {
  const data = await chrome.storage.local.get([STORAGE_TOKEN, STORAGE_DB_ID]);
  return { token: data[STORAGE_TOKEN], dbId: data[STORAGE_DB_ID] };
}

async function requireCredentials() {
  const { token, dbId } = await getCredentials();
  if (!token || !dbId) {
    throw new Error('Not connected. Set up your Notion connection first.');
  }
  return { token, dbId };
}

async function initializeTriggerMode() {
  try {
    const { [STORAGE_TRIGGER_MODE]: mode = MODE_AUTO_ALLOWLIST } =
      await chrome.storage.local.get(STORAGE_TRIGGER_MODE);
    await applyTriggerMode(mode);
  } catch (err) {
    console.error('Failed to initialize trigger mode:', err);
  }
}

async function applyTriggerMode(mode) {
  // Unregister all existing Pesto content scripts
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const pestoScripts = existing.filter((s) => s.id.startsWith('pesto-'));
    if (pestoScripts.length > 0) {
      await chrome.scripting.unregisterContentScripts({
        ids: pestoScripts.map((s) => s.id),
      });
    }
  } catch { /* ignore if none registered */ }

  if (mode === MODE_AUTO_ALL) {
    // Check if we actually have the <all_urls> permission
    const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (hasPermission) {
      await chrome.scripting.registerContentScripts([{
        id: 'pesto-auto-all',
        matches: ['<all_urls>'],
        js: ['content.js'],
        runAt: 'document_idle',
        allFrames: false,
      }]);
    }
  } else if (mode === MODE_AUTO_ALLOWLIST) {
    const { [STORAGE_ALLOWLIST]: allowlist = [] } =
      await chrome.storage.local.get(STORAGE_ALLOWLIST);

    const grantedSites = allowlist.filter((s) => s.status === 'granted');
    if (grantedSites.length > 0) {
      // Collect all patterns from granted sites
      const allPatterns = grantedSites.flatMap((s) => s.patterns);
      if (allPatterns.length > 0) {
        await chrome.scripting.registerContentScripts([{
          id: 'pesto-allowlist',
          matches: allPatterns,
          js: ['content.js'],
          runAt: 'document_idle',
          allFrames: false,
        }]);
      }
    }
  }
  // Mode 3 (click-to-arm): no scripts registered; injection is on-demand
}

async function validateRecents(recents, token, dbId) {
  try {
    const rows = await queryAllRows(token, dbId);
    const index = buildIndex(rows);
    await setCachedData(index);

    const validated = recents.filter((r) => {
      const match = index.find((entry) =>
        normalizeLabel(entry.canonical) === normalizeLabel(r.question) ||
        entry.normalizedAliases.includes(normalizeLabel(r.question))
      );
      if (!match) return false;
      return match.options.some((opt) => opt.trim() === r.option.trim());
    });

    if (validated.length !== recents.length) {
      await chrome.storage.local.set({ [STORAGE_RECENTS]: validated });
    }

    return validated;
  } catch {
    return recents;
  }
}

async function addRecent(questionCanonical, optionText) {
  const { [STORAGE_RECENTS]: recents = [] } = await chrome.storage.local.get(STORAGE_RECENTS);

  // Remove duplicate if exists
  const filtered = recents.filter(
    (r) => !(r.question === questionCanonical && r.option === optionText)
  );

  // Add to front
  filtered.unshift({
    question: questionCanonical,
    option: optionText,
    timestamp: Date.now(),
  });

  // Trim to max
  const trimmed = filtered.slice(0, MAX_RECENTS);
  await chrome.storage.local.set({ [STORAGE_RECENTS]: trimmed });
}

// ---------------------------------------------------------------------------
// Pin helpers
// ---------------------------------------------------------------------------

async function getAllPinned() {
  const { [STORAGE_PINNED]: pinned = {} } = await chrome.storage.local.get(STORAGE_PINNED);
  return pinned;
}

async function getPinnedForDb(dbId) {
  const allPinned = await getAllPinned();
  return allPinned[dbId] || [];
}

function isPinned(item, pinnedList) {
  return pinnedList.some(
    (p) => p.question === item.question && p.option === item.option
  );
}

function getDisplayRecents(recents, pinnedList) {
  return recents
    .filter((r) => !isPinned(r, pinnedList))
    .slice(0, 3);
}

async function validatePinned(pinned, token, dbId) {
  try {
    const rows = await queryAllRows(token, dbId);
    const index = buildIndex(rows);
    await setCachedData(index);

    const validated = pinned.filter((r) => {
      const match = index.find((entry) =>
        normalizeLabel(entry.canonical) === normalizeLabel(r.question) ||
        entry.normalizedAliases.includes(normalizeLabel(r.question))
      );
      if (!match) return false;
      return match.options.some((opt) => opt.trim() === r.option.trim());
    });

    if (validated.length !== pinned.length) {
      const allPinned = await getAllPinned();
      allPinned[dbId] = validated;
      await chrome.storage.local.set({ [STORAGE_PINNED]: allPinned });
    }

    return validated;
  } catch {
    return pinned;
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

async function handleMessage(message, sender) {
  const { type } = message;

  switch (type) {
    case MSG_MATCH_FIELD: {
      const { token, dbId } = await requireCredentials();
      // Use cached index when fresh (populated after first load or after a save).
      // This avoids a Notion API call on every field focus, which was making
      // suggestions unreliable when the fetch failed or took too long.
      // The cache is invalidated after MSG_SAVE_ANSWER so edits appear promptly.
      const index = await getOrFetch(token, dbId);
      const matches = findMatches(message.label, index);
      return { matches };
    }

    case MSG_SAVE_ANSWER: {
      const { token, dbId } = await requireCredentials();
      const { question, answer } = message;

      if (!question || !question.trim()) throw new Error('Question is required.');
      if (!answer || !answer.trim()) throw new Error('Answer is required.');
      if (answer.length > ANSWER_CHAR_LIMIT) {
        throw new Error(`Answer exceeds ${ANSWER_CHAR_LIMIT} character limit.`);
      }

      // Re-match against the current index to detect merge candidates
      const index = await getOrFetch(token, dbId);
      const normalizedQ = normalizeLabel(question);
      const mergeMatches = findMatches(normalizedQ, index, MERGE_THRESHOLD);

      let result;
      if (mergeMatches.length > 0) {
        const bestMatch = mergeMatches[0];
        const existingOptions = parseOptions(bestMatch.rawAnswer);
        const newOption = answer.trim();
        const merged = serializeOptions([...existingOptions, newOption]);

        if (merged.length <= ANSWER_CHAR_LIMIT) {
          // Merge: append as new numbered option
          await updatePageAnswer(token, bestMatch.id, merged);
          result = {
            action: 'merged',
            pageId: bestMatch.id,
            questionName: bestMatch.canonical,
            optionNumber: existingOptions.length + 1,
            optionCount: existingOptions.length + 1,
            insertText: newOption,
          };
        } else {
          // Fallback: create as new row (merged would exceed limit)
          const formattedAnswer = serializeOptions([answer.trim()]);
          const page = await createPage(token, dbId, question.trim(), formattedAnswer);
          result = {
            action: 'created_fallback',
            pageId: page?.id || null,
            questionName: question.trim(),
            insertText: answer.trim(),
          };
        }
      } else {
        // No merge candidate: create new row
        const formattedAnswer = serializeOptions([answer.trim()]);
        const page = await createPage(token, dbId, question.trim(), formattedAnswer);
        result = {
          action: 'created',
          pageId: page?.id || null,
          questionName: question.trim(),
          insertText: answer.trim(),
        };
      }

      // Invalidate cache so next match picks up the new data
      await clearCacheData();

      return result;
    }

    case MSG_DELETE_OPTION: {
      const { token, dbId } = await requireCredentials();
      const { pageId, optionIndex } = message;

      // Fetch current answer to rewrite it
      const index = await getOrFetch(token, dbId);
      const entry = index.find((e) => e.id === pageId);
      if (!entry) throw new Error('Question not found.');

      const options = [...entry.options];
      if (optionIndex < 0 || optionIndex >= options.length) {
        throw new Error('Invalid option index.');
      }

      if (options.length === 1) {
        // Last option: archive the entire row
        await archivePage(token, pageId);
        await clearCacheData();
        return { action: 'archived', questionName: entry.canonical };
      }

      // Remove the option and renumber
      options.splice(optionIndex, 1);
      const rewritten = serializeOptions(options);
      await updatePageAnswer(token, pageId, rewritten);
      await clearCacheData();

      return { action: 'deleted', questionName: entry.canonical, remainingOptions: options.length };
    }

    case MSG_ARCHIVE_ROW: {
      const { token } = await requireCredentials();
      await archivePage(token, message.pageId);
      await clearCacheData();
      return { action: 'archived' };
    }

    case MSG_GET_CONNECTION_STATUS: {
      const { token, dbId } = await getCredentials();
      const { [STORAGE_DB_NAME]: dbName } = await chrome.storage.local.get(STORAGE_DB_NAME);
      return {
        connected: !!(token && dbId),
        dbName: dbName || null,
      };
    }

    case MSG_UPDATE_RECENTS: {
      await addRecent(message.question, message.option);
      return { ok: true };
    }

    case MSG_TEST_CONNECTION: {
      const { token, dbId } = message;
      if (!token) return { valid: false, error: 'Token is required.' };
      if (!dbId) return { valid: false, error: 'Database ID is required.' };
      return notionTestConnection(token, dbId);
    }

    case MSG_SET_TOKEN: {
      await chrome.storage.local.set({ [STORAGE_TOKEN]: message.token });
      // Clear recents and cache — new token means potentially different workspace
      await chrome.storage.local.remove([STORAGE_RECENTS]);
      await clearCacheData();
      return { ok: true };
    }

    case MSG_SET_DATABASE: {
      const dbId = extractDbId(message.dbUrl);
      if (!dbId) {
        return { valid: false, error: 'Could not extract a database ID from that URL. Paste the full Notion database URL.' };
      }

      const { [STORAGE_TOKEN]: token } = await chrome.storage.local.get(STORAGE_TOKEN);
      if (!token) return { valid: false, error: 'Set your token first.' };

      const result = await notionTestConnection(token, dbId);
      if (result.valid) {
        await chrome.storage.local.set({
          [STORAGE_DB_ID]: dbId,
          [STORAGE_DB_NAME]: result.dbName,
          [STORAGE_DB_PARENT]: result.parentPageTitle || null,
        });
        // Clear recents and cache — different database means different data
        await chrome.storage.local.remove([STORAGE_RECENTS]);
        await clearCacheData();
      }
      return result;
    }

    case MSG_CREATE_DATABASE: {
      const { [STORAGE_TOKEN]: token } = await chrome.storage.local.get(STORAGE_TOKEN);
      if (!token) throw new Error('Set your token first.');

      const db = await notionCreateDatabase(token, message.parentPageId);
      const dbName = db.title?.map((rt) => rt.plain_text).join('') || 'Pesto Answers';

      // Look up parent page title for breadcrumb
      let dbParent = null;
      try {
        const pages = await notionSearchPages(token);
        const parentPage = pages.find((p) => p.id.replace(/-/g, '') === message.parentPageId.replace(/-/g, ''));
        if (parentPage) dbParent = parentPage.title;
      } catch { /* ignore */ }

      await chrome.storage.local.set({
        [STORAGE_DB_ID]: db.id,
        [STORAGE_DB_NAME]: dbName,
        [STORAGE_DB_PARENT]: dbParent,
      });
      // Clear recents and cache — fresh database has no history
      await chrome.storage.local.remove([STORAGE_RECENTS]);
      await clearCacheData();

      return { dbId: db.id, dbName };
    }

    case MSG_SEARCH_PAGES: {
      const { [STORAGE_TOKEN]: token } = await chrome.storage.local.get(STORAGE_TOKEN);
      if (!token) throw new Error('Set your token first.');
      const pages = await notionSearchPages(token);
      return { pages };
    }

    case MSG_SET_TRIGGER_MODE: {
      const mode = message.mode;
      await chrome.storage.local.set({ [STORAGE_TRIGGER_MODE]: mode });
      await applyTriggerMode(mode);
      return { ok: true };
    }

    case MSG_GET_RECENTS: {
      const { [STORAGE_RECENTS]: recents = [] } = await chrome.storage.local.get(STORAGE_RECENTS);
      const { token, dbId } = await getCredentials();

      if (!token || !dbId) return { recents: [], pinned: [] };

      const validated = await validateRecents(recents, token, dbId);
      const pinned = await getPinnedForDb(dbId);
      const validatedPinned = await validatePinned(pinned, token, dbId);
      const displayRecents = getDisplayRecents(validated, validatedPinned);

      return { recents: displayRecents, pinned: validatedPinned };
    }

    case MSG_PIN_RECENT: {
      const { question, option } = message;
      const { dbId } = await requireCredentials();
      const allPinned = await getAllPinned();
      const dbPinned = allPinned[dbId] || [];

      if (!isPinned({ question, option }, dbPinned)) {
        dbPinned.push({ question, option, timestamp: Date.now() });
        allPinned[dbId] = dbPinned;
        await chrome.storage.local.set({ [STORAGE_PINNED]: allPinned });
      }
      return { ok: true };
    }

    case MSG_UNPIN_RECENT: {
      const { question, option } = message;
      const { dbId } = await requireCredentials();
      const allPinned = await getAllPinned();
      const dbPinned = allPinned[dbId] || [];

      allPinned[dbId] = dbPinned.filter(
        (p) => !(p.question === question && p.option === option)
      );
      await chrome.storage.local.set({ [STORAGE_PINNED]: allPinned });
      return { ok: true };
    }

    case MSG_DISMISS_RECENT: {
      const { question, option } = message;
      const { [STORAGE_RECENTS]: recents = [] } = await chrome.storage.local.get(STORAGE_RECENTS);
      const updated = recents.filter(
        (r) => !(r.question === question && r.option === option)
      );
      await chrome.storage.local.set({ [STORAGE_RECENTS]: updated });
      return { ok: true };
    }

    case MSG_SEARCH_DATABASES: {
      const { [STORAGE_TOKEN]: token } = await chrome.storage.local.get(STORAGE_TOKEN);
      if (!token) throw new Error('Set your token first.');
      const databases = await notionSearchDatabases(token);
      return { databases };
    }

    case MSG_SWITCH_DATABASE: {
      const { dbId: newDbId } = message;
      const { [STORAGE_TOKEN]: token } = await chrome.storage.local.get(STORAGE_TOKEN);
      if (!token) throw new Error('Set your token first.');

      const result = await notionTestConnection(token, newDbId);
      if (!result.valid) return result;

      await chrome.storage.local.set({
        [STORAGE_DB_ID]: newDbId,
        [STORAGE_DB_NAME]: result.dbName,
        [STORAGE_DB_PARENT]: result.parentPageTitle || null,
      });
      // Clear recents and cache; pinned items are per-DB and persist
      await chrome.storage.local.remove([STORAGE_RECENTS]);
      await clearCacheData();

      return { ok: true, dbName: result.dbName };
    }

    case MSG_ADD_SITE: {
      const { domain, patterns, label, status } = message;
      const { [STORAGE_ALLOWLIST]: allowlist = [] } = await chrome.storage.local.get(STORAGE_ALLOWLIST);

      // Check if already in list
      const existing = allowlist.find((s) => s.domain === domain);
      if (existing) {
        existing.status = status || 'granted';
        existing.patterns = patterns;
      } else {
        allowlist.push({ domain, patterns, label: label || domain, status: status || 'granted' });
      }

      await chrome.storage.local.set({ [STORAGE_ALLOWLIST]: allowlist });

      // Re-apply trigger mode to update content script registration
      const { [STORAGE_TRIGGER_MODE]: mode = MODE_AUTO_ALLOWLIST } =
        await chrome.storage.local.get(STORAGE_TRIGGER_MODE);
      if (mode === MODE_AUTO_ALLOWLIST) {
        await applyTriggerMode(mode);
      }

      return { ok: true };
    }

    case MSG_REMOVE_SITE: {
      const { domain } = message;
      const { [STORAGE_ALLOWLIST]: allowlist = [] } = await chrome.storage.local.get(STORAGE_ALLOWLIST);
      const updated = allowlist.filter((s) => s.domain !== domain);
      await chrome.storage.local.set({ [STORAGE_ALLOWLIST]: updated });

      // Re-apply trigger mode
      const { [STORAGE_TRIGGER_MODE]: mode = MODE_AUTO_ALLOWLIST } =
        await chrome.storage.local.get(STORAGE_TRIGGER_MODE);
      if (mode === MODE_AUTO_ALLOWLIST) {
        await applyTriggerMode(mode);
      }

      return { ok: true };
    }

    case MSG_REFRESH_CACHE: {
      const { token, dbId } = await requireCredentials();
      await clearCacheData();
      const rows = await queryAllRows(token, dbId);
      const index = buildIndex(rows);
      await setCachedData(index);
      return { ok: true, rowCount: rows.length };
    }

    case MSG_CLEAR_CACHE: {
      await clearCacheData();
      return { ok: true };
    }

    case MSG_LOCK: {
      await chrome.storage.local.remove([
        STORAGE_TOKEN, STORAGE_DB_ID, STORAGE_DB_NAME, STORAGE_RECENTS,
        STORAGE_PINNED, STORAGE_DB_PARENT,
      ]);
      await clearCacheData();
      return { ok: true };
    }

    case MSG_ARM_TAB: {
      const tabId = message.tabId;
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });
      } catch (err) {
        throw new Error(`Could not inject into this tab: ${err.message}`);
      }

      const { [STORAGE_ARMED_TABS]: armed = [] } = await chrome.storage.local.get(STORAGE_ARMED_TABS);
      if (!armed.includes(tabId)) {
        armed.push(tabId);
        await chrome.storage.local.set({ [STORAGE_ARMED_TABS]: armed });
      }

      return { ok: true };
    }

    case MSG_GET_STATE: {
      const data = await chrome.storage.local.get([
        STORAGE_TOKEN, STORAGE_DB_ID, STORAGE_DB_NAME,
        STORAGE_TRIGGER_MODE, STORAGE_ALLOWLIST, STORAGE_RECENTS,
        STORAGE_PINNED, STORAGE_DB_PARENT,
      ]);
      const token = data[STORAGE_TOKEN];
      const dbId = data[STORAGE_DB_ID];
      const rawRecents = data[STORAGE_RECENTS] || [];
      const allPinned = data[STORAGE_PINNED] || {};
      const dbPinned = dbId ? (allPinned[dbId] || []) : [];

      let recents = rawRecents;
      let pinned = dbPinned;
      if (token && dbId) {
        if (rawRecents.length > 0) {
          recents = await validateRecents(rawRecents, token, dbId);
        }
        if (dbPinned.length > 0) {
          pinned = await validatePinned(dbPinned, token, dbId);
        }
      }

      const displayRecents = getDisplayRecents(recents, pinned);

      return {
        connected: !!(token && dbId),
        hasToken: !!token,
        dbId: dbId || null,
        dbName: data[STORAGE_DB_NAME] || null,
        dbParent: data[STORAGE_DB_PARENT] || null,
        triggerMode: data[STORAGE_TRIGGER_MODE] || MODE_AUTO_ALLOWLIST,
        allowlist: data[STORAGE_ALLOWLIST] || [],
        recents: displayRecents,
        pinned,
      };
    }

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}
