import {
  MSG_SET_TOKEN, MSG_SET_DATABASE, MSG_CREATE_DATABASE,
  MSG_SEARCH_PAGES, MSG_TEST_CONNECTION, MSG_SET_TRIGGER_MODE,
  MSG_ADD_SITE,
  MODE_AUTO_ALL, MODE_AUTO_ALLOWLIST, MODE_CLICK_TO_ARM,
  SEEDED_ALLOWLIST,
} from '../lib/constants.js';

import { requestAllUrls, requestOrigins } from '../lib/permissions.js';
import { extractDbId } from '../lib/notion-api.js';

const TOTAL_STEPS = 6;
let currentStep = 0;

// State collected during onboarding
const obState = {
  token: null,
  dbId: null,
  dbName: null,
  triggerMode: MODE_AUTO_ALLOWLIST,
  selectedSites: [],
};

document.addEventListener('DOMContentLoaded', () => {
  renderStep(0);
  setupNav();
});

function setupNav() {
  const backBtn = document.querySelector('.pesto-ob-back');
  const nextBtn = document.querySelector('.pesto-ob-next');

  backBtn.addEventListener('click', () => {
    if (currentStep > 0) {
      renderStep(currentStep - 1);
    }
  });

  nextBtn.addEventListener('click', async () => {
    const canAdvance = await validateAndAdvance();
    if (canAdvance && currentStep < TOTAL_STEPS - 1) {
      renderStep(currentStep + 1);
    }
  });
}

function renderStep(step) {
  currentStep = step;
  const content = document.querySelector('.pesto-ob-step-content');
  const backBtn = document.querySelector('.pesto-ob-back');
  const nextBtn = document.querySelector('.pesto-ob-next');

  content.innerHTML = '';
  backBtn.style.display = step > 0 ? 'block' : 'none';

  // Progress dots
  const progress = document.querySelector('.pesto-ob-progress');
  progress.innerHTML = '';
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = 'pesto-ob-dot';
    if (i === step) dot.classList.add('active');
    else if (i < step) dot.classList.add('completed');
    progress.appendChild(dot);
  }

  switch (step) {
    case 0: renderStep1Token(content, nextBtn); break;
    case 1: renderStep2Share(content, nextBtn); break;
    case 2: renderStep3Database(content, nextBtn); break;
    case 3: renderStep4Test(content, nextBtn); break;
    case 4: renderStep5Mode(content, nextBtn); break;
    case 5: renderStep6Done(content, nextBtn); break;
  }
}

async function validateAndAdvance() {
  // Step-specific validation before advancing
  switch (currentStep) {
    case 0: { // Token
      const input = document.querySelector('#ob-token');
      const token = input?.value.trim();
      if (!token) {
        showStepStatus('Please paste your installation access token.', 'error');
        return false;
      }
      obState.token = token;
      await chrome.runtime.sendMessage({ type: MSG_SET_TOKEN, token });
      return true;
    }
    case 1: // Share page — informational, always advance
      return true;
    case 2: // Database — must have DB connected
      if (!obState.dbId) {
        showStepStatus('Connect or create a database before continuing.', 'error');
        return false;
      }
      return true;
    case 3: // Test — informational after test
      return true;
    case 4: { // Trigger mode — handle permissions
      await handleModePermissions();
      return true;
    }
    case 5: // Done
      return true;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Step renderers
// ---------------------------------------------------------------------------

function renderStep1Token(content, nextBtn) {
  nextBtn.textContent = 'Continue';
  nextBtn.disabled = false;

  content.innerHTML = `
    <div class="pesto-ob-step-title">Step 1: Create your Notion connection</div>
    <div class="pesto-ob-step-body">
      <ol>
        <li>Open <a href="https://www.notion.so/profile/integrations" target="_blank">Notion Integrations</a></li>
        <li>Click <strong>New integration</strong> (or <strong>Create new integration</strong>)</li>
        <li>Name it <strong>Pesto</strong>, pick your workspace, and save</li>
        <li>Open the connection's <strong>Configuration</strong> tab</li>
        <li>Copy the <strong>Internal Integration Secret</strong> (starts with <code>ntn_</code>)</li>
      </ol>
      <p><strong>Important:</strong> Make sure your connection has <strong>Read content</strong>, <strong>Insert content</strong>, and <strong>Update content</strong> capabilities enabled.</p>
      <div class="pesto-ob-field">
        <label for="ob-token">Installation Access Token</label>
        <input type="password" id="ob-token" class="pesto-ob-input" placeholder="ntn_..." value="${obState.token || ''}">
      </div>
    </div>
  `;
}

function renderStep2Share(content, nextBtn) {
  nextBtn.textContent = 'Continue';
  nextBtn.disabled = false;

  content.innerHTML = `
    <div class="pesto-ob-step-title">Step 2: Share a Notion page with Pesto</div>
    <div class="pesto-ob-step-body">
      <p>Open the Notion page where your answer bank lives (or where you want to create one).</p>
      <ol>
        <li>Click the <strong>...</strong> menu in the top-right corner of the page</li>
        <li>Select <strong>+ Add Connections</strong></li>
        <li>Find and select <strong>Pesto</strong></li>
        <li>Click <strong>Confirm</strong></li>
      </ol>
      <div class="pesto-ob-status info">
        This is the most common cause of connection failures. If you skip this step, Pesto won't be able to access your database.
      </div>
    </div>
  `;
}

function renderStep3Database(content, nextBtn) {
  nextBtn.textContent = 'Continue';
  nextBtn.disabled = !obState.dbId;

  content.innerHTML = `
    <div class="pesto-ob-step-title">Step 3: Connect your answer bank</div>
    <div class="pesto-ob-step-body">
      <p>Choose how to set up your Pesto answer bank:</p>
    </div>
    <div class="pesto-ob-tabs">
      <button class="pesto-ob-tab active" data-tab="existing">Connect existing database</button>
      <button class="pesto-ob-tab" data-tab="create">Create one for me</button>
    </div>
    <div id="ob-tab-content"></div>
  `;

  const tabContent = content.querySelector('#ob-tab-content');
  const tabs = content.querySelectorAll('.pesto-ob-tab');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'existing') {
        renderExistingDbTab(tabContent, nextBtn);
      } else {
        renderCreateDbTab(tabContent, nextBtn);
      }
    });
  });

  renderExistingDbTab(tabContent, nextBtn);
}

function renderExistingDbTab(container, nextBtn) {
  container.innerHTML = `
    <div class="pesto-ob-field">
      <label for="ob-db-url">Database URL or ID</label>
      <input type="text" id="ob-db-url" class="pesto-ob-input" placeholder="Paste your Notion database URL">
    </div>
    <button class="pesto-ob-action" id="ob-connect-btn">Connect</button>
  `;

  const connectBtn = container.querySelector('#ob-connect-btn');
  connectBtn.addEventListener('click', async () => {
    const urlInput = container.querySelector('#ob-db-url');
    const val = urlInput.value.trim();
    if (!val) return;

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    const result = await chrome.runtime.sendMessage({ type: MSG_SET_DATABASE, dbUrl: val });
    if (result.valid) {
      obState.dbId = result.dbId || extractDbId(val);
      obState.dbName = result.dbName;
      showStepStatus(`Connected to "${result.dbName}" (${result.rowCount} rows)`, 'success');
      nextBtn.disabled = false;
    } else {
      showStepStatus(result.error, 'error');
    }
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
  });
}

async function renderCreateDbTab(container, nextBtn) {
  container.innerHTML = '<div class="pesto-ob-status info">Loading shared pages...</div>';

  try {
    const result = await chrome.runtime.sendMessage({ type: MSG_SEARCH_PAGES });
    const pages = result.pages || [];

    if (pages.length === 0) {
      container.innerHTML = `
        <div class="pesto-ob-status error">
          No shared pages found. Go back to Step 2 and share a page with your Pesto connection first.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="pesto-ob-field">
        <label for="ob-parent-page">Parent page</label>
        <select id="ob-parent-page" class="pesto-ob-select"></select>
      </div>
      <button class="pesto-ob-action" id="ob-create-btn">Create Pesto Database</button>
    `;

    const select = container.querySelector('#ob-parent-page');
    for (const page of pages) {
      const opt = document.createElement('option');
      opt.value = page.id;
      opt.textContent = page.title;
      select.appendChild(opt);
    }

    const createBtn = container.querySelector('#ob-create-btn');
    createBtn.addEventListener('click', async () => {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      try {
        const result = await chrome.runtime.sendMessage({
          type: MSG_CREATE_DATABASE,
          parentPageId: select.value,
        });

        if (result.error) {
          showStepStatus(result.error, 'error');
        } else {
          obState.dbId = result.dbId;
          obState.dbName = result.dbName;
          showStepStatus(`Created "${result.dbName}" with an example row.`, 'success');
          nextBtn.disabled = false;
        }
      } catch (err) {
        showStepStatus(err.message, 'error');
      }
      createBtn.disabled = false;
      createBtn.textContent = 'Create Pesto Database';
    });
  } catch (err) {
    container.innerHTML = `<div class="pesto-ob-status error">Error: ${err.message}. Make sure you set your token in Step 1.</div>`;
  }
}

function renderStep4Test(content, nextBtn) {
  nextBtn.textContent = 'Continue';
  nextBtn.disabled = false;

  content.innerHTML = `
    <div class="pesto-ob-step-title">Step 4: Test your connection</div>
    <div class="pesto-ob-step-body">
      <p>Let's verify everything is set up correctly.</p>
    </div>
    <button class="pesto-ob-action" id="ob-test-btn">Test Connection</button>
    <div id="ob-test-result"></div>
  `;

  const testBtn = content.querySelector('#ob-test-btn');
  const resultDiv = content.querySelector('#ob-test-result');

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    resultDiv.innerHTML = '';

    const result = await chrome.runtime.sendMessage({
      type: MSG_TEST_CONNECTION,
      token: obState.token,
      dbId: obState.dbId,
    });

    if (result.valid) {
      resultDiv.innerHTML = `
        <div class="pesto-ob-status success" style="margin-top:12px">
          Connected to <strong>${result.dbName}</strong> (${result.rowCount} rows)
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="pesto-ob-status error" style="margin-top:12px">
          ${result.error}
        </div>
      `;
    }

    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  });
}

function renderStep5Mode(content, nextBtn) {
  nextBtn.textContent = 'Continue';
  nextBtn.disabled = false;

  content.innerHTML = `
    <div class="pesto-ob-step-title">Step 5: When should Pesto activate?</div>
    <div class="pesto-ob-step-body">
      <p>Choose how Pesto runs on web pages:</p>
    </div>
    <div class="pesto-ob-radio-group" id="ob-mode-group"></div>
    <div id="ob-mode-details"></div>
  `;

  const group = content.querySelector('#ob-mode-group');
  const details = content.querySelector('#ob-mode-details');

  const modes = [
    {
      value: MODE_AUTO_ALLOWLIST,
      label: 'Auto on my sites (Recommended)',
      desc: 'Pesto runs on sites you choose — like Greenhouse, Lever, and LinkedIn. Each site requires a one-time permission approval.',
    },
    {
      value: MODE_AUTO_ALL,
      label: 'Auto on all pages',
      desc: 'Pesto runs on every site automatically. Requires broad browser permissions.',
    },
    {
      value: MODE_CLICK_TO_ARM,
      label: 'Click-to-arm per tab',
      desc: 'Nothing runs until you click the Pesto toolbar icon. Lowest footprint, maximum control.',
    },
  ];

  modes.forEach((mode) => {
    const radio = document.createElement('div');
    radio.className = 'pesto-ob-radio';
    if (obState.triggerMode === mode.value) radio.classList.add('selected');

    radio.innerHTML = `
      <input type="radio" name="trigger-mode" value="${mode.value}" ${obState.triggerMode === mode.value ? 'checked' : ''}>
      <div>
        <div class="pesto-ob-radio-label">${mode.label}</div>
        <div class="pesto-ob-radio-desc">${mode.desc}</div>
      </div>
    `;

    radio.addEventListener('click', () => {
      obState.triggerMode = mode.value;
      group.querySelectorAll('.pesto-ob-radio').forEach((r) => r.classList.remove('selected'));
      radio.classList.add('selected');
      radio.querySelector('input').checked = true;
      renderModeDetails(details);
    });

    group.appendChild(radio);
  });

  renderModeDetails(details);
}

function renderModeDetails(container) {
  container.innerHTML = '';

  if (obState.triggerMode === MODE_AUTO_ALLOWLIST) {
    container.innerHTML = `
      <div style="margin-top:12px">
        <div class="pesto-ob-step-body"><p>Select the sites you use for job applications:</p></div>
        <div class="pesto-ob-site-list" id="ob-site-list"></div>
      </div>
    `;

    const list = container.querySelector('#ob-site-list');
    obState.selectedSites = SEEDED_ALLOWLIST.map((s) => s.domain);

    SEEDED_ALLOWLIST.forEach((site) => {
      const item = document.createElement('div');
      item.className = 'pesto-ob-site-item';
      item.innerHTML = `
        <input type="checkbox" checked data-domain="${site.domain}">
        <span>${site.label}</span>
      `;
      const checkbox = item.querySelector('input');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!obState.selectedSites.includes(site.domain)) {
            obState.selectedSites.push(site.domain);
          }
        } else {
          obState.selectedSites = obState.selectedSites.filter((d) => d !== site.domain);
        }
      });
      list.appendChild(item);
    });
  }
}

async function handleModePermissions() {
  await chrome.runtime.sendMessage({ type: MSG_SET_TRIGGER_MODE, mode: obState.triggerMode });

  if (obState.triggerMode === MODE_AUTO_ALL) {
    const granted = await requestAllUrls();
    if (!granted) {
      // Fallback to allowlist mode
      obState.triggerMode = MODE_AUTO_ALLOWLIST;
      await chrome.runtime.sendMessage({ type: MSG_SET_TRIGGER_MODE, mode: MODE_AUTO_ALLOWLIST });
    }
  } else if (obState.triggerMode === MODE_AUTO_ALLOWLIST && obState.selectedSites.length > 0) {
    // Collect all patterns for selected sites
    const allPatterns = [];
    const selectedSiteData = [];
    for (const domain of obState.selectedSites) {
      const seedEntry = SEEDED_ALLOWLIST.find((s) => s.domain === domain);
      if (seedEntry) {
        allPatterns.push(...seedEntry.patterns);
        selectedSiteData.push(seedEntry);
      }
    }

    if (allPatterns.length > 0) {
      const granted = await requestOrigins(allPatterns);
      if (granted) {
        // Register all selected sites
        for (const site of selectedSiteData) {
          await chrome.runtime.sendMessage({
            type: MSG_ADD_SITE,
            domain: site.domain,
            patterns: site.patterns,
            label: site.label,
            status: 'granted',
          });
        }
      }
    }
  }
}

function renderStep6Done(content, nextBtn) {
  nextBtn.textContent = 'Get Started';
  nextBtn.disabled = false;

  nextBtn.onclick = () => window.close();

  const modeDesc = {
    [MODE_AUTO_ALL]: 'Pesto will activate on every page automatically.',
    [MODE_AUTO_ALLOWLIST]: 'Pesto will activate on your allowlisted sites. You can manage your site list from the toolbar menu.',
    [MODE_CLICK_TO_ARM]: 'Click the Pesto icon in your toolbar to activate it on any tab.',
  };

  content.innerHTML = `
    <div class="pesto-ob-done">
      <h2>You're all set!</h2>
      <p>${modeDesc[obState.triggerMode] || ''}</p>
      <p>When you focus a text input, the <strong>Pesto button</strong> will appear. Click it to see your saved answers or save new ones.</p>
      <p style="margin-top:16px; font-size:12px; color:#b0aeab;">
        Your data stays between your browser and your Notion workspace.<br>
        Nothing is sent to Pesto or any third party.<br>
        Not affiliated with Notion.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showStepStatus(message, type) {
  // Remove any existing status in the step content
  const existing = document.querySelector('.pesto-ob-step-content .pesto-ob-status:not(.info)');
  if (existing) existing.remove();

  const status = document.createElement('div');
  status.className = `pesto-ob-status ${type}`;
  status.textContent = message;
  status.style.marginTop = '12px';
  document.querySelector('.pesto-ob-step-content').appendChild(status);
}
