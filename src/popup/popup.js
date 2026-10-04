import {
  MSG_GET_STATE, MSG_SET_TOKEN, MSG_SET_DATABASE, MSG_CREATE_DATABASE,
  MSG_SEARCH_PAGES, MSG_TEST_CONNECTION, MSG_SET_TRIGGER_MODE,
  MSG_GET_RECENTS, MSG_ADD_SITE, MSG_REMOVE_SITE,
  MSG_LOCK, MSG_ARM_TAB,
  MSG_DELETE_OPTION, MSG_ARCHIVE_ROW,
  MSG_PIN_RECENT, MSG_UNPIN_RECENT, MSG_DISMISS_RECENT,
  STORAGE_TOKEN, STORAGE_DB_ID, STORAGE_DB_NAME,
  STORAGE_TRIGGER_MODE, STORAGE_ALLOWLIST, STORAGE_RECENTS,
  STORAGE_PINNED, STORAGE_DB_PARENT,
  MODE_AUTO_ALL, MODE_AUTO_ALLOWLIST, MODE_CLICK_TO_ARM,
  SEEDED_ALLOWLIST,
} from '../lib/constants.js';

import {
  requestAllUrls, removeAllUrls, requestOrigin, removeOrigin,
  normalizeToPattern, isBroadDomain, requestOrigins,
} from '../lib/permissions.js';

import { extractDbId } from '../lib/notion-api.js';

const root = document.getElementById('pesto-popup');

const KNOWN_JOB_SITES = [
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'myworkdayjobs.com',
  'linkedin.com',
  'indeed.com',
  'smartrecruiters.com',
  'ashbyhq.com',
  'icims.com',
  'jobvite.com',
  'bamboohr.com',
  'workable.com',
  'wellfound.com',
  'dover.io',
  'taleo.net',
  'successfactors.com',
];

const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 51 51" fill="none"><rect x="10.5" y="4.5" width="30" height="19" rx="2" fill="#538700"/><rect x="10.5" y="27.5" width="16" height="19" rx="2" fill="#538700"/></svg>`;

/** True when loaded inside the widget iframe (vs. standalone popup) */
const IS_WIDGET = window.parent !== window;

/** Notify the widget container of the current content height */
function notifyParentHeight() {
  if (IS_WIDGET) {
    window.parent.postMessage({
      type: 'PESTO_WIDGET_RESIZE',
      height: document.documentElement.scrollHeight,
    }, '*');
  }
}

/** Close the popup — works in both widget iframe and standalone contexts */
function closePopup() {
  if (IS_WIDGET) {
    window.parent.postMessage({ type: 'PESTO_WIDGET_CLOSE' }, '*');
  } else {
    window.close();
  }
}

// Auto-detect height changes and notify the widget container
if (IS_WIDGET) {
  new ResizeObserver(() => notifyParentHeight()).observe(document.documentElement);
}

// Keep the MV3 service worker alive while this popup page is open.
// Without default_popup, Chrome no longer auto-keeps the SW alive;
// an active chrome.runtime.Port is the standard keepalive mechanism.
// IMPORTANT: the port must be held in a variable — if it's not referenced,
// the JS GC collects it immediately, closing the port and killing the keepalive.
// The port is automatically disconnected when this document is unloaded
// (iframe reload or tab close), allowing the SW to sleep again.
let _swKeepalive = null;
function _connectKeepalive() {
  try {
    _swKeepalive = chrome.runtime.connect({ name: 'pesto-popup' });
    _swKeepalive.onDisconnect.addListener(() => {
      // SW was terminated and restarted — reconnect to keep it alive
      if (chrome.runtime?.id) _connectKeepalive();
    });
  } catch { /* ignore: extension context invalid on restricted pages */ }
}
_connectKeepalive();

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    // Read directly from local storage — no Notion API calls, instant render
    const data = await chrome.storage.local.get([
      STORAGE_TOKEN, STORAGE_DB_ID, STORAGE_DB_NAME,
      STORAGE_TRIGGER_MODE, STORAGE_ALLOWLIST, STORAGE_RECENTS,
      STORAGE_PINNED, STORAGE_DB_PARENT,
    ]);
    const token = data[STORAGE_TOKEN];
    const dbId = data[STORAGE_DB_ID];
    const allPinned = data[STORAGE_PINNED] || {};
    const dbPinned = dbId ? (allPinned[dbId] || []) : [];
    const rawRecents = data[STORAGE_RECENTS] || [];

    // Filter recents: exclude pinned items, cap at 3
    const displayRecents = rawRecents
      .filter((r) => !dbPinned.some((p) => p.question === r.question && p.option === r.option))
      .slice(0, 3);

    const state = {
      connected: !!(token && dbId),
      hasToken: !!token,
      dbId: dbId || null,
      dbName: data[STORAGE_DB_NAME] || null,
      dbParent: data[STORAGE_DB_PARENT] || null,
      triggerMode: data[STORAGE_TRIGGER_MODE] || MODE_AUTO_ALLOWLIST,
      allowlist: data[STORAGE_ALLOWLIST] || [],
      recents: displayRecents,
      pinned: dbPinned,
    };

    if (state.connected) {
      renderConnected(state);
    } else {
      renderNotConnected(state);
    }
  } catch (err) {
    root.innerHTML = `<div class="pesto-status error">Failed to load: ${err.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Shared header builder
// ---------------------------------------------------------------------------

function buildHeader() {
  const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  const GRAB_SVG = `<svg viewBox="0 0 10 16" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/></svg>`;

  const header = el('div', 'pesto-header');

  const grabHandle = el('button', 'pesto-header-grab');
  grabHandle.innerHTML = GRAB_SVG;
  grabHandle.title = 'Move';
  if (!IS_WIDGET) grabHandle.style.display = 'none';
  grabHandle.addEventListener('mousedown', (e) => {
    if (!IS_WIDGET) return;
    e.preventDefault();
    window.parent.postMessage({
      type: 'PESTO_WIDGET_DRAG_START',
      mouseX: e.clientX,
      mouseY: e.clientY,
    }, '*');
  });
  header.appendChild(grabHandle);

  const logo = el('div', 'pesto-logo-small');
  logo.innerHTML = LOGO_SVG;
  header.appendChild(logo);

  const title = el('div', 'pesto-header-title');
  title.textContent = 'Pesto';
  header.appendChild(title);

  const closeBtn = el('button', 'pesto-header-close');
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', closePopup);
  header.appendChild(closeBtn);

  return header;
}

// ---------------------------------------------------------------------------
// Not connected view
// ---------------------------------------------------------------------------

function renderNotConnected(state) {
  root.innerHTML = '';

  root.appendChild(buildHeader());

  // Status
  const chip = el('div', 'pesto-connection-chip');
  chip.innerHTML = `<div class="pesto-dot disconnected"></div>Not connected`;
  root.appendChild(chip);

  root.appendChild(el('div', 'pesto-divider'));

  // Token input
  const tokenGroup = el('div', 'pesto-input-group');
  const tokenLabel = el('label', 'pesto-input-label');
  tokenLabel.textContent = 'Installation Access Token';
  const tokenInput = el('input', 'pesto-input');
  tokenInput.type = 'password';
  tokenInput.placeholder = 'ntn_...';
  if (state.hasToken) tokenInput.value = '••••••••••••';
  tokenGroup.appendChild(tokenLabel);
  tokenGroup.appendChild(tokenInput);

  const tokenHint = el('div', 'pesto-status info');
  tokenHint.textContent = 'Ensure your connection has Read, Insert, and Update content enabled.';
  tokenGroup.appendChild(tokenHint);
  root.appendChild(tokenGroup);

  // Save token button
  const saveTokenBtn = el('button', 'pesto-btn-primary');
  saveTokenBtn.textContent = state.hasToken ? 'Update Token' : 'Save Token';
  saveTokenBtn.style.margin = '0 8px 8px';
  saveTokenBtn.style.width = 'calc(100% - 16px)';
  saveTokenBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token || token === '••••••••••••') return;
    await chrome.runtime.sendMessage({ type: MSG_SET_TOKEN, token });
    tokenInput.value = '••••••••••••';
    saveTokenBtn.textContent = 'Token saved';
    setTimeout(() => { saveTokenBtn.textContent = 'Update Token'; }, 1500);
  });
  root.appendChild(saveTokenBtn);

  root.appendChild(el('div', 'pesto-divider'));

  // Database connection
  const dbSection = el('div', 'pesto-section');
  const dbLabel = el('div', 'pesto-section-label');
  dbLabel.textContent = 'Database';
  dbSection.appendChild(dbLabel);

  // Path A: Connect existing
  const dbGroup = el('div', 'pesto-input-group');
  const dbInput = el('input', 'pesto-input');
  dbInput.placeholder = 'Paste Notion database URL or ID';
  dbGroup.appendChild(dbInput);

  const connectBtn = el('button', 'pesto-btn-primary');
  connectBtn.textContent = 'Connect Existing Database';
  connectBtn.addEventListener('click', async () => {
    const val = dbInput.value.trim();
    if (!val) return;
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    const result = await chrome.runtime.sendMessage({ type: MSG_SET_DATABASE, dbUrl: val });
    if (result.valid) {
      init(); // Reload as connected
    } else {
      showStatus(dbGroup, result.error, 'error');
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect Existing Database';
    }
  });
  dbGroup.appendChild(connectBtn);
  dbSection.appendChild(dbGroup);

  // Path B: Create for me
  const createBtn = el('button', 'pesto-btn-secondary');
  createBtn.textContent = 'Create Database for Me';
  createBtn.style.margin = '0 8px 8px';
  createBtn.style.width = 'calc(100% - 16px)';
  createBtn.addEventListener('click', () => showCreateDbFlow(dbSection));
  dbSection.appendChild(createBtn);

  root.appendChild(dbSection);

  // Privacy note
  const privacy = el('div', 'pesto-privacy-note');
  privacy.textContent = 'Your token is stored locally on this device. Never sent to a third party. Not affiliated with Notion.';
  root.appendChild(privacy);
}

async function showCreateDbFlow(container) {
  // Search for shared pages
  let pages;
  try {
    const result = await chrome.runtime.sendMessage({ type: MSG_SEARCH_PAGES });
    pages = result.pages || [];
  } catch (err) {
    showStatus(container, 'Set your token first.', 'error');
    return;
  }

  if (pages.length === 0) {
    showStatus(container, 'No shared pages found. Share a page with your Pesto connection first.', 'error');
    return;
  }

  const group = el('div', 'pesto-input-group');
  const label = el('label', 'pesto-input-label');
  label.textContent = 'Pick a parent page';
  group.appendChild(label);

  const select = document.createElement('select');
  select.className = 'pesto-select';
  for (const page of pages) {
    const opt = document.createElement('option');
    opt.value = page.id;
    opt.textContent = page.title;
    select.appendChild(opt);
  }
  group.appendChild(select);

  const createBtn = el('button', 'pesto-btn-primary');
  createBtn.textContent = 'Create Pesto Database';
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      const result = await chrome.runtime.sendMessage({
        type: MSG_CREATE_DATABASE,
        parentPageId: select.value,
      });
      if (result.error) {
        showStatus(group, result.error, 'error');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Pesto Database';
      } else {
        init(); // Reload as connected
      }
    } catch (err) {
      showStatus(group, err.message, 'error');
      createBtn.disabled = false;
      createBtn.textContent = 'Create Pesto Database';
    }
  });
  group.appendChild(createBtn);
  container.appendChild(group);
}

// ---------------------------------------------------------------------------
// Connected view
// ---------------------------------------------------------------------------

function renderConnected(state) {
  root.innerHTML = '';

  root.appendChild(buildHeader());

  // Connection status with breadcrumb
  const connectionChip = el('div', 'pesto-connection-chip');
  connectionChip.innerHTML = `<div class="pesto-dot"></div>`;
  const breadcrumbText = state.dbParent
    ? `${esc(state.dbParent)} / ${esc(state.dbName || 'database')}`
    : esc(state.dbName || 'Connected');
  const chipText = document.createElement('span');
  chipText.innerHTML = breadcrumbText;
  connectionChip.appendChild(chipText);

  // "Open in Notion" link — direct URL to the connected database
  if (state.dbId) {
    const notionLink = document.createElement('a');
    notionLink.className = 'pesto-notion-link';
    notionLink.href = `https://www.notion.so/${state.dbId.replace(/-/g, '')}`;
    notionLink.target = '_blank';
    notionLink.rel = 'noopener noreferrer';
    notionLink.textContent = 'Open in Notion ↗';
    connectionChip.appendChild(notionLink);
  }

  root.appendChild(connectionChip);

  // Mode 3: Arm this tab button
  if (state.triggerMode === MODE_CLICK_TO_ARM) {
    const armRow = el('div', 'pesto-row primary');
    armRow.innerHTML = `<div class="pesto-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></div>`;
    const armText = el('span', 'pesto-row-text');
    armText.textContent = 'Arm this tab';
    armRow.appendChild(armText);
    armRow.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await chrome.runtime.sendMessage({ type: MSG_ARM_TAB, tabId: tab.id });
          armText.textContent = 'Armed!';
          setTimeout(() => closePopup(), 500);
        }
      } catch (err) {
        armText.textContent = `Error: ${err.message}`;
      }
    });
    root.appendChild(armRow);
  }

  root.appendChild(el('div', 'pesto-divider'));

  // Trigger mode
  const modeLabel = el('div', 'pesto-section-label');
  modeLabel.textContent = 'Trigger mode';
  root.appendChild(modeLabel);

  const segmented = el('div', 'pesto-segmented');
  const modes = [
    { value: MODE_AUTO_ALL, label: 'All pages' },
    { value: MODE_AUTO_ALLOWLIST, label: 'My sites' },
    { value: MODE_CLICK_TO_ARM, label: 'Click-to-arm' },
  ];

  for (const mode of modes) {
    const btn = el('button', 'pesto-segment');
    btn.textContent = mode.label;
    if (state.triggerMode === mode.value) btn.classList.add('active');
    btn.addEventListener('click', async () => {
      await handleModeSwitch(mode.value, state.triggerMode);
    });
    segmented.appendChild(btn);
  }
  root.appendChild(segmented);

  // Pinned (above My Sites)
  const pinnedSection = renderPinned(state.pinned);
  if (pinnedSection) root.appendChild(pinnedSection);

  // Allowlist section (Mode 2 only)
  if (state.triggerMode === MODE_AUTO_ALLOWLIST) {
    renderAllowlist(state.allowlist);
  }

  root.appendChild(el('div', 'pesto-divider'));

  // Recents
  renderRecents(state.recents);

  root.appendChild(el('div', 'pesto-divider'));

  // Settings
  renderSettings();

  // Footer
  const footer = el('div', 'pesto-footer');
  footer.innerHTML = 'Built by <a href="https://www.linkedin.com/in/pournamipottekat" target="_blank" rel="noopener">Pournami Pottekat</a> &middot; Not affiliated with Notion';
  root.appendChild(footer);
}

async function handleModeSwitch(newMode, currentMode) {
  if (newMode === currentMode) return;

  if (newMode === MODE_AUTO_ALL) {
    const granted = await requestAllUrls();
    if (!granted) return; // User denied
  }

  if (currentMode === MODE_AUTO_ALL) {
    await removeAllUrls();
  }

  await chrome.runtime.sendMessage({ type: MSG_SET_TRIGGER_MODE, mode: newMode });
  init(); // Reload
}

function renderAllowlist(allowlist) {
  const SMALL_X_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  const section = el('div', 'pesto-section');
  const label = el('div', 'pesto-section-label');
  label.textContent = 'My sites';
  section.appendChild(label);

  const badgesWrap = el('div', 'pesto-site-badges');

  for (const site of allowlist) {
    const badge = el('span', `pesto-site-badge ${site.status === 'granted' ? 'active' : 'revoked'}`);

    const badgeText = el('span', 'pesto-site-badge-text');
    badgeText.textContent = site.label || site.domain;
    badge.appendChild(badgeText);

    const removeBtn = el('span', 'pesto-site-badge-remove');
    removeBtn.innerHTML = SMALL_X_SVG;
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await removeOrigin(site.domain); } catch { /* ignore */ }
      await chrome.runtime.sendMessage({ type: MSG_REMOVE_SITE, domain: site.domain });
      init();
    });
    badge.appendChild(removeBtn);

    if (site.status === 'revoked') {
      badge.title = 'Click to re-grant';
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', async (e) => {
        if (e.target.closest('.pesto-site-badge-remove')) return;
        const granted = await requestOrigins(site.patterns);
        if (granted) {
          await chrome.runtime.sendMessage({
            type: MSG_ADD_SITE,
            domain: site.domain,
            patterns: site.patterns,
            label: site.label,
            status: 'granted',
          });
          init();
        }
      });
    }

    badgesWrap.appendChild(badge);
  }

  // Add site button
  const addBtn = el('button', 'pesto-site-add-btn');
  addBtn.textContent = '+ Add site';
  addBtn.addEventListener('click', () => showSiteSelector(section, allowlist));
  badgesWrap.appendChild(addBtn);

  // Add current site shortcut
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.url) {
      try {
        const host = new URL(tab.url).hostname.replace(/^www\./, '');
        const alreadyListed = allowlist.some((s) => s.domain === host);
        if (!alreadyListed && host && host.includes('.')) {
          const addCurrentBtn = el('button', 'pesto-site-add-btn');
          addCurrentBtn.textContent = `+ Add ${host}`;
          addCurrentBtn.addEventListener('click', async () => { await addSite(host); });
          badgesWrap.appendChild(addCurrentBtn);
        }
      } catch { /* ignore invalid URLs */ }
    }
  });

  section.appendChild(badgesWrap);
  root.appendChild(section);
}

function showSiteSelector(container, allowlist) {
  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

  // Toggle: clicking "+ Add site" again closes the selector and syncs the full popup
  const existing = container.querySelector('.pesto-site-selector');
  if (existing) { existing.remove(); init(); return; }

  // Combine known sites with any custom domains already in the allowlist
  const customDomains = allowlist
    .map((s) => s.domain)
    .filter((d) => !KNOWN_JOB_SITES.includes(d));
  const allSites = [...KNOWN_JOB_SITES, ...customDomains];

  // Local mutable snapshot — updated after each add/remove so the list
  // re-renders in place without destroying and rebuilding the whole popup.
  const localList = allowlist.map((s) => ({ ...s }));

  const panel = el('div', 'pesto-site-selector');

  const searchInput = el('input', 'pesto-site-selector-input');
  searchInput.placeholder = 'Search or enter domain...';
  panel.appendChild(searchInput);

  const list = el('div', 'pesto-site-list');
  panel.appendChild(list);

  // Add a site without calling init() — updates localList and re-renders the list only
  async function handleAdd(domain) {
    const host = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0].toLowerCase();
    if (!host || !host.includes('.')) return;
    if (isBroadDomain(host)) {
      if (!confirm(`This will run Pesto on every ${host} page. Continue?`)) return;
    }
    const pattern = normalizeToPattern(host);
    if (!pattern) return;
    const granted = await requestOrigins([pattern]);
    if (!granted) return;
    await chrome.runtime.sendMessage({ type: MSG_ADD_SITE, domain: host, patterns: [pattern], label: host, status: 'granted' });
    localList.push({ domain: host, patterns: [pattern], label: host, status: 'granted' });
    if (!allSites.includes(host)) allSites.push(host);
    renderList(searchInput.value);
  }

  // Remove a site without calling init()
  async function handleRemove(siteObj) {
    try { await removeOrigin(siteObj.domain); } catch { /* ignore */ }
    await chrome.runtime.sendMessage({ type: MSG_REMOVE_SITE, domain: siteObj.domain });
    const idx = localList.findIndex((s) => s.domain === siteObj.domain);
    if (idx !== -1) localList.splice(idx, 1);
    renderList(searchInput.value);
  }

  function buildRow(domain) {
    const siteObj = localList.find((s) => s.domain === domain);
    const isAdded = !!siteObj;
    const row = el('div', `pesto-site-list-item${isAdded ? ' checked' : ''}`);
    const indicator = el('span', 'pesto-site-check');
    if (isAdded) indicator.innerHTML = CHECK_SVG;
    row.appendChild(indicator);
    const label = el('span', 'pesto-site-list-label');
    label.textContent = domain;
    row.appendChild(label);
    row.addEventListener('click', () => {
      if (isAdded) handleRemove(siteObj);
      else handleAdd(domain);
    });
    return row;
  }

  function renderList(query) {
    list.innerHTML = '';
    const q = query.toLowerCase().trim();
    const filtered = q ? allSites.filter((s) => s.includes(q)) : allSites;

    const isNewDomain = q && q.includes('.') && !allSites.some((s) => s === q);
    if (isNewDomain) list.appendChild(buildRow(q));

    for (const domain of filtered) list.appendChild(buildRow(domain));

    if (list.childElementCount === 0) {
      const empty = el('div', 'pesto-site-list-empty');
      empty.textContent = 'No matching sites — type a full domain to add it.';
      list.appendChild(empty);
    }
  }

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  renderList('');

  container.appendChild(panel);
  searchInput.focus();
}

async function addSite(domainInput) {
  const host = domainInput.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0].toLowerCase();
  if (!host || !host.includes('.')) return;

  if (isBroadDomain(host)) {
    if (!confirm(`This will run Pesto on every ${host} page. Continue?`)) return;
  }

  const pattern = normalizeToPattern(host);
  if (!pattern) return;

  const granted = await requestOrigins([pattern]);
  if (!granted) return;

  await chrome.runtime.sendMessage({
    type: MSG_ADD_SITE,
    domain: host,
    patterns: [pattern],
    label: host,
    status: 'granted',
  });

  init();
}


/** Returns the pinned section element, or null if there are no pinned items. */
function renderPinned(pinned) {
  if (!pinned || pinned.length === 0) return null;

  const section = el('div', 'pesto-section');
  const pinnedLabel = el('div', 'pesto-section-label');
  pinnedLabel.textContent = 'Pinned';
  section.appendChild(pinnedLabel);

  for (const item of pinned) {
    const row = el('div', 'pesto-row');

    const text = el('span', 'pesto-row-text');
    text.textContent = item.option;
    text.title = `${item.question}: ${item.option}`;
    row.appendChild(text);

    const actions = el('div', 'pesto-row-actions');
    actions.appendChild(createCopyButton(item.option));

    const unpinBtn = el('div', 'pesto-row-action');
    unpinBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 2.2 6 6l-3 3 5.5 5.5"/><path d="m18 22-5.5-5.5L16 13l3.8-3.7"/><line x1="2" y1="22" x2="22" y2="2"/></svg>`;
    unpinBtn.title = 'Unpin';
    unpinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({
        type: MSG_UNPIN_RECENT,
        question: item.question,
        option: item.option,
      });
      init();
    });
    actions.appendChild(unpinBtn);

    row.appendChild(actions);
    section.appendChild(row);
  }

  return section;
}

function renderRecents(recents) {
  const section = el('div', 'pesto-section');
  const recentsLabel = el('div', 'pesto-section-label');
  recentsLabel.textContent = 'Recents';
  section.appendChild(recentsLabel);

  if (!recents || recents.length === 0) {
    const empty = el('div', 'pesto-row');
    const emptyText = el('span', 'pesto-row-text');
    emptyText.textContent = 'No recent insertions';
    emptyText.style.fontStyle = 'italic';
    emptyText.style.color = '#b0aeab';
    empty.appendChild(emptyText);
    empty.style.cursor = 'default';
    section.appendChild(empty);
  } else {
    for (const recent of recents) {
      const row = el('div', 'pesto-row');

      const text = el('span', 'pesto-row-text');
      text.textContent = recent.option;
      text.title = `${recent.question}: ${recent.option}`;
      row.appendChild(text);

      const actions = el('div', 'pesto-row-actions');
      actions.appendChild(createCopyButton(recent.option));

      const pinBtn = el('div', 'pesto-row-action');
      pinBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 2h6l-1.5 4.5H10.5z"/><path d="M10.5 6.5 8 13h8l-2.5-6.5"/></svg>`;
      pinBtn.title = 'Pin';
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await chrome.runtime.sendMessage({
          type: MSG_PIN_RECENT,
          question: recent.question,
          option: recent.option,
        });
        init();
      });
      actions.appendChild(pinBtn);

      const dismissBtn = el('div', 'pesto-row-action');
      dismissBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      dismissBtn.title = 'Dismiss';
      dismissBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await chrome.runtime.sendMessage({
          type: MSG_DISMISS_RECENT,
          question: recent.question,
          option: recent.option,
        });
        row.remove();
      });
      actions.appendChild(dismissBtn);

      row.appendChild(actions);
      section.appendChild(row);
    }
  }

  root.appendChild(section);
}

function createCopyButton(textToCopy) {
  const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

  const btn = el('div', 'pesto-row-action');
  btn.innerHTML = COPY_SVG;
  btn.title = 'Copy';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      btn.innerHTML = CHECK_SVG;
      setTimeout(() => { btn.innerHTML = COPY_SVG; }, 1000);
    } catch { /* clipboard API may fail */ }
  });
  return btn;
}

function renderSettings() {
  const section = el('div', 'pesto-section');
  const label = el('div', 'pesto-section-label');
  label.textContent = 'Settings';
  section.appendChild(label);

  // Lock (clear credentials)
  const lockRow = el('div', 'pesto-row');
  lockRow.innerHTML = `<div class="pesto-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>`;
  const lockText = el('span', 'pesto-row-text');
  lockText.textContent = 'Lock (clear credentials)';
  lockRow.appendChild(lockText);
  lockRow.addEventListener('click', async () => {
    if (!confirm('This will clear your token and disconnect from Notion. Continue?')) return;
    await chrome.runtime.sendMessage({ type: MSG_LOCK });
    init();
  });
  section.appendChild(lockRow);

  root.appendChild(section);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showStatus(container, message, type) {
  // Remove existing status
  const existing = container.querySelector('.pesto-status');
  if (existing) existing.remove();

  const status = el('div', `pesto-status ${type}`);
  status.textContent = message;
  container.appendChild(status);
}
