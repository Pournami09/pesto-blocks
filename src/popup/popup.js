import {
  MSG_GET_STATE, MSG_SET_TOKEN, MSG_SET_DATABASE, MSG_CREATE_DATABASE,
  MSG_SEARCH_PAGES, MSG_TEST_CONNECTION, MSG_SET_TRIGGER_MODE,
  MSG_GET_RECENTS, MSG_ADD_SITE, MSG_REMOVE_SITE,
  MSG_LOCK, MSG_ARM_TAB,
  MSG_DELETE_OPTION, MSG_ARCHIVE_ROW,
  MODE_AUTO_ALL, MODE_AUTO_ALLOWLIST, MODE_CLICK_TO_ARM,
  SEEDED_ALLOWLIST,
} from '../lib/constants.js';

import {
  requestAllUrls, removeAllUrls, requestOrigin, removeOrigin,
  normalizeToPattern, isBroadDomain, requestOrigins,
} from '../lib/permissions.js';

import { extractDbId } from '../lib/notion-api.js';

const root = document.getElementById('pesto-popup');

const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 51 51" fill="none"><rect x="10.5" y="4.5" width="30" height="19" rx="2" fill="#538700"/><rect x="10.5" y="27.5" width="16" height="19" rx="2" fill="#538700"/></svg>`;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const state = await chrome.runtime.sendMessage({ type: MSG_GET_STATE });
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
// Not connected view
// ---------------------------------------------------------------------------

function renderNotConnected(state) {
  root.innerHTML = '';

  // Header
  const header = el('div', 'pesto-header');
  header.innerHTML = `<div class="pesto-logo-small">${LOGO_SVG}</div><div class="pesto-header-title">Pesto</div>`;
  root.appendChild(header);

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

  // Header
  const header = el('div', 'pesto-header');
  header.innerHTML = `<div class="pesto-logo-small">${LOGO_SVG}</div><div class="pesto-header-title">Pesto</div>`;
  root.appendChild(header);

  // Connection chip
  const chip = el('div', 'pesto-connection-chip');
  chip.innerHTML = `<div class="pesto-dot"></div>Connected to ${esc(state.dbName || 'database')}`;
  root.appendChild(chip);

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
          setTimeout(() => window.close(), 500);
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
  footer.textContent = 'Not affiliated with Notion';
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
  const section = el('div', 'pesto-section');
  const label = el('div', 'pesto-section-label');
  label.textContent = 'My sites';
  section.appendChild(label);

  // Site rows
  for (const site of allowlist) {
    const row = el('div', 'pesto-site-row');

    const domain = el('span', 'pesto-site-domain');
    domain.textContent = site.label || site.domain;
    row.appendChild(domain);

    const status = el('span', `pesto-site-status ${site.status}`);
    status.textContent = site.status === 'granted' ? 'Active' : 'Revoked';
    if (site.status === 'revoked') {
      status.title = 'Click to re-grant';
      status.addEventListener('click', async () => {
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
    row.appendChild(status);

    const remove = el('span', 'pesto-site-remove');
    remove.textContent = '×';
    remove.title = 'Remove';
    remove.addEventListener('click', async () => {
      for (const pattern of site.patterns) {
        try { await removeOrigin(site.domain); } catch { /* ignore */ }
      }
      await chrome.runtime.sendMessage({ type: MSG_REMOVE_SITE, domain: site.domain });
      init();
    });
    row.appendChild(remove);

    section.appendChild(row);
  }

  // Add site row
  const addRow = el('div', 'pesto-row primary');
  addRow.innerHTML = `<div class="pesto-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></div>`;
  const addText = el('span', 'pesto-row-text');
  addText.textContent = 'Add site';
  addRow.appendChild(addText);
  addRow.addEventListener('click', () => showAddSiteInput(section));
  section.appendChild(addRow);

  // Add current site shortcut
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.url) {
      try {
        const host = new URL(tab.url).hostname.replace(/^www\./, '');
        const alreadyListed = allowlist.some((s) => s.domain === host);
        if (!alreadyListed && host && host.includes('.')) {
          const addCurrentRow = el('div', 'pesto-row');
          addCurrentRow.innerHTML = `<div class="pesto-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></div>`;
          const currentText = el('span', 'pesto-row-text');
          currentText.textContent = `Add ${host}`;
          addCurrentRow.appendChild(currentText);
          addCurrentRow.addEventListener('click', async () => {
            await addSite(host);
          });
          section.appendChild(addCurrentRow);
        }
      } catch { /* ignore invalid URLs */ }
    }
  });

  root.appendChild(section);
}

function showAddSiteInput(container) {
  // Check if already showing
  if (container.querySelector('.pesto-add-site-input')) return;

  const group = el('div', 'pesto-input-group pesto-add-site-input');
  const input = el('input', 'pesto-input');
  input.placeholder = 'e.g., greenhouse.io';
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const domain = input.value.trim();
      if (domain) await addSite(domain);
    }
  });
  group.appendChild(input);

  const btn = el('button', 'pesto-btn-primary');
  btn.textContent = 'Add';
  btn.addEventListener('click', async () => {
    const domain = input.value.trim();
    if (domain) await addSite(domain);
  });
  group.appendChild(btn);

  container.appendChild(group);
  input.focus();
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

function renderRecents(recents) {
  const section = el('div', 'pesto-section');
  const label = el('div', 'pesto-section-label');
  label.textContent = 'Recents';
  section.appendChild(label);

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

      // Copy button
      const copyBtn = el('div', 'pesto-row-action');
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      copyBtn.title = 'Copy';
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(recent.option);
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
          }, 1000);
        } catch { /* clipboard API may fail */ }
      });
      actions.appendChild(copyBtn);

      // Delete button
      const deleteBtn = el('div', 'pesto-row-action trash');
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // For recents, we just remove from local list (not from Notion)
        // A full implementation would match to the Notion row and delete
        row.remove();
      });
      actions.appendChild(deleteBtn);

      row.appendChild(actions);
      section.appendChild(row);
    }
  }

  root.appendChild(section);
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
