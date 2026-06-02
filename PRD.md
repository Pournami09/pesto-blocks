# PRD — Pesto: Notion-Backed Form Autofill Chrome Extension

**Author:** Poro
**Status:** **v1.3 — three trigger modes (Auto / Allowlist / Click-to-arm) with `optional_host_permissions` model**
**Last updated:** 2026-05-31

---

## 0. How to read this document

This PRD is written from a staff product designer's lens. It (a) describes the product and flows, (b) records architectural decisions, and (c) keeps actively critiquing the idea. Friction is called out with **`⚠ Risk`** (must address), **`🔧 Decision`** (locked-in choice), and **`❓ Open`** (needs your call). Nothing here is final until you say so.

---

## 0.1 Decision log (cumulative through v1.3)

| Topic | Locked decision | Round |
|---|---|---|
| In-field icon visibility | Always on, while input is focused | v0.2 |
| Toolbar-driven trigger mode | **Three modes (v1.3):** (1) **Auto on all pages** — requires `<all_urls>` granted at runtime, (2) **Auto on my sites** — user-managed allowlist of domains, each permission requested at runtime, (3) **Click-to-arm per tab** — `activeTab` only, no host permissions. *Default: Auto on my sites with a seeded ATS list.* | v1.3 |
| Permission acquisition pattern | **Optional host permissions** — install with only `activeTab` (no scary prompt); request `<all_urls>` or specific origins *in onboarding when the user picks the mode*, via `chrome.permissions.request`. | v1.3 |
| Click-to-arm lifetime | **Per-tab** (clears on tab close) | v0.3 |
| Toolbar icon armed/unarmed badge | **No badge** | v0.3 |
| Password-manager coexistence | Detect & offset left + manual override | v0.2 |
| Telemetry | Zero content telemetry; local opt-in counters only | v0.2 |
| Notion schema | Two required columns: `Question` (title) + `Answer` (rich_text) | v0.2 |
| Aliases | **Pipe-delimited aliases inside the `Question` cell** — `Full name \| Your name \| Name`. First segment is canonical display; all segments feed the match index. *(Reversed from v0.5.)* | v1.0 |
| Numbered-bullet format in `Answer` cell | `^\d+\.\s` prefix per option; preserves multi-line within an option | v0.2 |
| Local cache | Confirmed | v0.2 |
| Insert into non-empty field | **Append** with separator | v0.2 |
| Append separator | Single newline for multi-line, single space for single-line (Q6 still open — `❓` below) | open |
| Components | Figma Pesto Dropdown Button, Pesto Dropdown Menu, Answer Preview Tooltip — specs locked in §13 | v0.3 |
| Component placement | Button = top-right inside input; Menu = 10px below, width = input.width with **min 320px** | v0.2 + v0.3 |
| Save-then-also-insert | **Yes — save creates the row, then immediately inserts that answer into the focused field** | v0.3 |
| Save into existing Question row | **Merge — append as a new numbered option to the existing `Answer` cell** (Question text untouched) | v0.3 |
| Delete-the-row vs delete-the-option | **Delete just the specific numbered option** (PATCH the `Answer` cell) | v0.3 |
| "Hard delete" labeling | Confirm dialog headline = "Move to Notion trash"; row affordance icon = standard delete/trash icon | v0.3 |
| Pencil icon affordance | **No-op for v1** (icon visible per Figma; no action wired) | v0.3 |
| App menu — create-DB-for-me | **Yes — onboarding button creates the Pesto DB in a parent page the user shares with the integration** | v0.3 |
| Notion integration capabilities required | **Read + Insert + Update** *(Update added in v0.3 — see §3.1 callout)* | v0.3 |
| Recents (in-field) | Parsed options of the matched Question, ordered by local last-used | v0.3 |
| Recents (toolbar) | Global recently-inserted answers (local-only) | v0.2 |
| Delete affordance scope | **Delete icon present in BOTH the in-field menu rows AND the toolbar Recents rows** | v0.4 |
| Merge-as-new-option UX | **Silent merge + toast confirmation** ("Added as option N to '…'"); no pre-confirm dialog | v0.4 |
| Merge overflow (>2000 chars) | **Auto-fallback: create as a new row instead**; toast explains ("Couldn't add to existing question — saved as a new question") | v0.4 |
| Delete (trash) icon color | **Brand grey default; red on hover** | v0.4 |
| Right-side icon cluster (enter + trash) | **Side-by-side, revealed on row hover** | v0.5 |
| Post-save toast | **Fire-and-forget, no Undo** in v1 | v0.5 |
| Append separator (locked) | **`\n` for `<textarea>` / `contenteditable`; single space for single-line `<input>`** | v1.0 |
| Toolbar Recents storage | **Local-only, no cross-device sync** | v1.0 |
| Notion schema | **Two required columns, exact names: `Question` (title) and `Answer` (rich_text).** Live DB updated to match. | v1.2 |
| Build-agent skill | **Use the Chrome team's `chrome-extensions` skill (Modern Web Guidance) in Claude Code when building** — see §14. | v1.2 |
| Target browser | Chrome only for v1 | v0.2 |

---

## 1. Problem & context

Job seekers re-enter the same information across dozens of application forms, job-portal profiles, and recruiter intake pages. Retrieval means context-switching, searching, and copy-pasting — repeated hundreds of times across a search.

Two jobs-to-be-done:

1. **Recall & fill** — surface the answer at the moment of focus.
2. **Capture & grow** — when there's no match, save the answer back to Notion in one move, so next time it's there.

The Notion database is the **single source of truth**, owned entirely by the user.

### Target user

Active job seekers running high-volume application strategies; secondarily anyone who repeatedly fills forms with stable personal data.

### Why an extension

The work happens *in the browser, in the input field*. A separate app the user alt-tabs to does not solve the friction. Value is realtime, in-context surfacing.

---

## 2. Goals, non-goals & success metrics

### Goals
- Surface saved answers inline the instant a text input gains focus, ranked by match confidence.
- Insert with one click; never clobber existing typing.
- Let the user save a new Question+Answer pair from the same surface, then auto-insert it.
- Toolbar app menu: connection setup (incl. create-database-for-me), trigger-mode preference, Recents (copy/delete), settings.
- Strictly between the user's browser and their own Notion. No backend. No content telemetry.
- Light theme, follows the Pesto component system in Figma.

### Non-goals
- No file uploads / résumé parsing.
- No autofill of non-text controls in v1 (`<select>`, radios, checkboxes, date pickers, rich-text editors, `contenteditable`).
- No multi-user / team sharing.
- No content telemetry. Aggregate, local, opt-in counters only.
- No automatic form submission.
- No password / credential / payment autofill.

### Success metrics (local-only, opt-in)
| Metric | Signal | Storage |
|---|---|---|
| Insert rate | % of menus opened that end in an insert | `chrome.storage.local` |
| Save rate | New Q+A saved per session | `chrome.storage.local` |
| Match hit rate | % of focused fields with ≥1 suggestion | `chrome.storage.local` |
| Retention proxy | Notion DB row growth | User-visible in Notion |

---

## 3. Architecture

### 3.1 Authentication — Notion **internal connection** with an installation access token

**`🔧 Decision`** Use a Notion **internal connection** (Notion's current term for what was previously called an "internal integration"). The user creates the connection in Notion's developer portal, copies its **installation access token** from the Configuration tab, and pastes it into Pesto's toolbar app menu. Token stored in `chrome.storage.local`. No OAuth, no backend.

**Terminology note (validated v1.1 against the official quickstart):** Notion's current docs use "connection" instead of "integration" and "installation access token" instead of "internal integration secret." All onboarding copy in Pesto should match the live Notion UI to avoid confusing users — the older terms appear in many tutorials but the in-product surface uses the new ones.

**`⚠ Risk` — connection capabilities.** Pesto's v0.3+ decisions (option-level delete via PATCH, merge-as-new-option via PATCH, archive-to-trash via PATCH) all use `PATCH /v1/pages` — which requires **Update content** capability. The minimum capability set is **Read content + Insert content + Update content**. The current quickstart does not surface capability picking explicitly in its setup walkthrough, so Phase 0 must verify (a) where capability checkboxes live in the current Notion UI (likely Configuration tab or a Capabilities tab), and (b) what the API error code/shape is when a request is rejected for missing capability — so we can show a precise "your connection needs Update content enabled" recovery message.

**Alternative considered: Personal Access Tokens (PAT).** Notion now offers PATs as a lighter alternative for "user-owned script or CLI workflow" use cases. We're sticking with internal connections because they support explicit per-page sharing (cleaner permission model) and are the only path documented for connection-creates-database flows. Document PATs as a future option only if onboarding friction proves too high.

Token security: never logged, never synced via `chrome.storage.sync`, "Lock / Clear" control in app menu. The trade-off (unencrypted at rest on disk) is documented in onboarding.

### 3.2 The CORS reality — all calls via service worker

**`⚠ Risk` (critical).** `api.notion.com` does not send permissive CORS headers, so a `fetch` from a content script will be blocked. In MV3, the background service worker with `host_permissions` for `https://api.notion.com/*` is not subject to page-CORS. All Notion traffic goes through the worker; the content script messages it via `chrome.runtime.sendMessage`. Token stays out of the page's JS context.

**`🔧 Decision` — use raw `fetch`, not the Notion JS SDK.** The official `@notionhq/client` SDK is Node-oriented and pulls in dependencies that bloat an MV3 service-worker bundle. Make Notion calls with `fetch` directly, always including the pinned `Notion-Version` header (the SDK normally sets this automatically — without the SDK we set it ourselves on every request). Wrap calls in a thin adapter so a future version bump is a one-file change.

### 3.3 Notion data model — Question + Answer only

**Required columns (any others — like the `Status` column in the live `Pesto Blocks Database` — are ignored):**

| Property | Notion type | Purpose |
|---|---|---|
| **Question** | `title` | Canonical question text + optional pipe-delimited aliases. Required. Exact name. |
| **Answer** | `rich_text` | The value(s). One or more numbered options. Required. Exact name. |

Both names are validated on every connection check. If either is missing or renamed, onboarding shows a recoverable error pointing to the fix ("Your database needs a column literally named `Question` of type Title, and one literally named `Answer` of type Text").

Implementation note: read the title column by its `title` *type* (defensive — survives the user temporarily renaming it via the Notion UI), but validate on connect that the type-resolved title column is also named `Question` so onboarding errors fire correctly.

**Aliases via the `|` delimiter.** The `Question` cell can hold one or more alias phrasings separated by ` | ` (pipe with surrounding spaces). The **first segment** is the canonical display name shown in UI; **every segment** feeds the match index pointing back to the same row. Example:

```
Full name | Your name | Name | Applicant full name
```

This single row will match focused inputs whose extracted label resembles any of those four phrasings. Empty segments are ignored; whitespace is trimmed; segment count is unbounded but ≤6 keeps cells readable. The pipe character is stored fine in `title` / `rich_text`, so no escaping required. The rare user who genuinely needs a literal `|` in their canonical Question is out of luck in v1; document the limitation.

**Numbered-bullet parsing rules (v1, strict):**
- Each option begins at column 0 with `^\d+\.\s` (e.g. `1. `, `2. `, `10. `).
- Text after the prefix, up to the next prefix or end-of-cell, is the option.
- Hard line breaks within an option are preserved.
- No numbered markers anywhere → the entire cell is treated as a single option.
- Empty options are ignored.

The extension writes back in the same format. Onboarding shows an example.

**`⚠ Risk` — 2000-char cap.** A single `rich_text` value tops out at 2000 characters. With multiple long options stacked in one cell, this is reachable. Warn at 1500, hard-block at 2000.

**`⚠ Risk` — schema drift.** If the user renames `Question` or `Answer`, the extension breaks silently. Validate on every connection check; specific, recoverable error.

**Create-database-for-me (new in v0.3).** The app menu's connection form offers two paths after the token is pasted:

- **(A) Connect existing database** — paste the DB URL.
- **(B) Create one for me** — user shares a *parent page* with the integration; Pesto calls `POST /v1/databases` with that page as parent, schema `{ Question: title, Answer: rich_text }`, plus a seed row demonstrating the numbered-bullet format. Onboarding ends with a "Click here to open your new Pesto database in Notion" link.

Path B requires the integration to have Insert content capability (it does, per §3.1) and the user to share at least one parent page first.

### 3.4 Matching strategy

Tiered:

1. **Exact** (normalized: lowercased, trimmed, punctuation/asterisks stripped).
2. **Fuzzy string** — Jaro-Winkler / Dice / token-set; threshold-gated.
3. **(V3) On-device semantic** — two viable paths, pick one in Phase 3 after benchmarking:
   - **(a) `transformers.js`** running `all-MiniLM-L6-v2` in WASM. Ships in our bundle; works in all Chrome versions; ~tens of MB.
   - **(b) Chrome's built-in Prompt API / Gemini Nano** (`window.ai` / Built-in AI APIs). Zero bundle cost, runs on Chrome's bundled model, but requires Chrome 138+ and has hardware constraints (Google's docs require ~22GB free storage, 4GB+ VRAM). Worth investigating because no model download to bundle and inference is free — but availability is gated and we'd need a graceful fallback when it's not present. The Chrome extensions skill (§14) carries up-to-date guidance on these APIs.
   - Both options keep semantic matching strictly on-device.

Matching expands each stored row into its alias set (split on ` | `), then runs the tiered matchers against all alias tokens. Match confidence on a row is the **max** confidence across its aliases. Display still uses the canonical first segment so the UI stays clean.

When a save triggers the merge-as-new-option path (Flow C) on a row that already has aliases, only the **`Answer`** cell is touched — the alias list in `Question` is never mutated automatically. If the user wants to add the detected label as a new alias, they do so by editing the row in Notion (or via a Phase 3 "learn this phrasing as an alias" affordance — see Phase 3).

Fuzzy threshold recommendation: **0.75 for tier 2** when matching against alias tokens (slightly more permissive than threshold-without-aliases because the alias set already filters out most paraphrasing noise).

**Label extraction from the page DOM** — priority order:

1. `aria-label`
2. `aria-labelledby` → referenced element text
3. `<label for="id">`
4. Wrapping `<label>` ancestor text
5. `placeholder`
6. Nearest preceding visible text node / heading
7. `name` / `id` attribute, de-camel/snake-cased

Then clean: strip required markers (`*`, "(required)"), trailing colons, surrounding boilerplate, collapse whitespace, lowercase.

**`⚠ Risk`** Label extraction quality is the make-or-break engineering problem. Plan for a meaningful miss rate and lean on Save flow to recover gracefully.

### 3.5 Local cache

Cached in `chrome.storage.local`, refreshed on: (a) app open, (b) manual refresh, (c) 10-min TTL since last query. Settings include "Clear local cache." Without caching, every focus would re-query Notion and hit the 3 req/s limit instantly.

### 3.6 Component architecture (MV3)

- **Service worker:** holds token, owns all Notion API calls (Read query, Insert page, Insert database, PATCH page for archive/merge/option-delete), holds the in-memory answer index, runs matching, debounces and rate-limits writes, retries on transient failure.
- **Content script:** detects focus, extracts label, positions in-field button, renders dropdown menu and tooltip in **closed Shadow DOM**, inserts text via the native setter + dispatched `input`/`change` events, sends save / delete / merge requests to the worker.
- **Toolbar popup (app menu):** *not-connected* state (token + connect/create-DB), *connected* state (mode toggle, Recents, settings, Lock).

**MV3 service worker lifecycle — non-negotiable build rules** (sourced from Chrome's official SW tutorial):

- **Ephemeral by design.** Chrome terminates the SW after ~30 seconds of inactivity. **Every Chrome API event listener resets that 30s timer**, but anything in transit at termination is lost. Build assuming the SW can die between any two operations.
- **No global variables for state.** Globals don't survive termination. **All state — answer cache, last-used counters, trigger-mode preference — must live in `chrome.storage.local`.** The SW rehydrates from storage on wake.
- **Register event listeners at the top level**, synchronously, not nested in async functions. Chrome needs to know which events your SW handles so it can wake the SW for them. A listener registered inside an async callback may never fire after a cold start.
- **Use `chrome.alarms`, never `setTimeout` / `setInterval`** for any delayed or periodic task (cache TTL refresh, recents pruning, etc.). Timers are killed when the SW terminates; alarms persist.
- **SW is an ES module.** Manifest declares `"background": { "service_worker": "service-worker.js", "type": "module" }`, which lets us import the Notion adapter, matcher, and parser as separate modules.
- **No DOM access in the SW.** All UI work happens in the content script (Shadow DOM) and the popup.
- **DevTools wakes the SW.** When debugging, opening DevTools on the SW keeps it alive — meaning real-world bugs around termination may not reproduce while inspecting. Close DevTools to test the cold-start path.

**Permissions in `manifest.json`** (each justified in the Web Store listing):

- `"permissions": ["storage", "alarms", "scripting", "activeTab"]` — base permissions; no scary install prompt.
- `"host_permissions": ["https://api.notion.com/*"]` — so the SW can call Notion past CORS. Granted at install (Notion-only is innocuous).
- `"optional_host_permissions": ["<all_urls>"]` — requested at runtime *only if* the user picks **Auto on all pages** during onboarding.
- For **Auto on my sites** (the default mode), each domain the user adds is requested individually via `chrome.permissions.request({origins: ["https://*.example.com/*"]})` at the moment of add — no upfront declaration needed beyond the `optional_host_permissions` umbrella.

### 3.7 Trigger modes

Three mutually-exclusive modes, picked during onboarding and changeable anytime in the app menu. Each maps to a different Chrome permission posture, which determines install friction and reviewer scrutiny.

**Mode 1 — Auto on all pages**
- Pesto runs on every site automatically.
- Requires `<all_urls>` host permission, requested via `chrome.permissions.request` during onboarding (not at install).
- Chrome surfaces a prompt: *"Pesto wants permission to: Read and change all your data on all websites."* User accepts → mode active. User declines → onboarding offers Mode 2 or Mode 3 as fallback.
- Best for users who want zero friction across many sites.

**Mode 2 — Auto on my sites (default)**
- Pesto runs only on domains the user has explicitly allowlisted.
- Each domain added → Pesto calls `chrome.permissions.request({origins: ["https://*.example.com/*"]})` → Chrome shows a per-origin permission prompt → user accepts → that domain is permanently allowlisted and Pesto auto-runs there.
- Ships with a **seeded default allowlist** of common application-tracking systems (see below). User can add or remove freely.
- This is the recommended default for the job-seeker target user — it matches the actual application surface (a known set of ATS platforms) without paying the `<all_urls>` permission cost.

**Mode 3 — Click-to-arm per tab**
- Nothing runs on any page until the user clicks the Pesto toolbar icon for that tab.
- Uses `activeTab` only — the cleanest permission model.
- Once armed, extension stays active for the **lifetime of that tab** (cleared on close or reload). No toolbar badge per v0.3 decision.
- Best for users who want maximum control / lowest footprint.

**Seeded default allowlist for Mode 2** (user can edit anytime):

| Site | Match pattern | Notes |
|---|---|---|
| Greenhouse | `https://*.greenhouse.io/*`, `https://job-boards.greenhouse.io/*` | Direct Greenhouse-hosted boards. Companies that embed Greenhouse via iframe on their own domain — see §8 iframe limitation. |
| Lever | `https://jobs.lever.co/*` | |
| Ashby | `https://jobs.ashbyhq.com/*` | |
| Workday | `https://*.myworkdayjobs.com/*`, `https://*.workday.com/*` | Most companies on `*.myworkdayjobs.com`. |
| LinkedIn Easy Apply | `https://www.linkedin.com/jobs/*` | |
| Wellfound | `https://wellfound.com/*` | |

Seeded as **suggestions** in the allowlist UI, not auto-granted — each still requires the user to confirm Chrome's permission prompt the first time. This way the user sees and understands what they're approving rather than rubber-stamping a list.

**`⚠ Risk` — cross-origin iframes still a hard limit.** Many companies embed Greenhouse/Lever as an iframe inside their own careers page (e.g., `stripe.com/careers/abc` with a Greenhouse iframe). Pesto can inject into `stripe.com` but cannot reach into the cross-origin iframe to see the form. The allowlist helps when users land *directly* on the ATS domain (`boards.greenhouse.io/stripe/jobs/abc`) — onboarding should educate users to click "Apply directly on Greenhouse" links when available.

**Permission management edge cases:**
- User revokes a permission via Chrome's `chrome://extensions` settings → Pesto detects via `chrome.permissions.onRemoved` → updates the allowlist UI to show "Revoked — click to re-grant."
- User adds a domain but declines the Chrome prompt → Pesto removes it from the allowlist immediately so the UI stays truthful.
- Switching from Mode 1 → Mode 2 → Mode 3 progressively removes permissions via `chrome.permissions.remove` to keep the install minimal.

### 3.8 Password-manager coexistence

**`🔧 Decision`** Detect commonly-installed password managers; place the Pesto button to the **left** of the PM icon when present.

**Detection strategy:**

1. **Known DOM markers (best-effort):** 1Password (`[data-com-onepassword-filled]`, `com-1password-button`, `*.1password.com` iframes); Bitwarden (`[data-bwignore]`, overlay container); LastPass (`[data-lpignore]`, `lpform-*`, LP iframe); Dashlane (`dashlane-*` host elements).
2. **Visual collision check:** measure rendered content inside the input's right-edge ~28px via `elementsFromPoint`; if non-empty, offset Pesto by detected width + 4px gap.
3. **Auto-shift fallback:** any uncatalogued overlap triggers the same offset.
4. **User manual override:** per-site icon-offset stepper + per-site disable toggle in app menu.

**`⚠ Risk`** Heuristic detection will sometimes miss; manual override is the safety net.

**`⚠ Risk` — never compete for password fields.** Hard suppression: `input[type=password]`, `autocomplete="current-password|new-password|cc-*|one-time-code"`, names/ids matching `password|ssn|card|cvv|cvc|account`.

---

## 4. Information architecture & surfaces

Five UI surfaces:

1. **Pesto Dropdown Button** — in-field icon, top-right inside the input bounds when focused. Variants: Default, Default Hover, DropdownOpen, DropdownOpen Hover.
2. **Pesto Dropdown Menu** — 10px below input, width = input width (min 320px). Variants: *Save Button + Dropdown Answers*; *Only Save Button*.
3. **Answer Preview Tooltip** — appears on hover of a menu row, to its **left**.
4. **Toolbar app menu** — the Pesto Dropdown Menu primitive, repurposed for connection + settings + global Recents.
5. **Onboarding page** — used for the integration walkthrough (with screenshots), opens on install.

---

## 5. Visual design direction

Light theme; the Pesto component system in Figma is the source of truth. §13 below contains the exact tokens and dimensions pulled from the live design.

**`⚠ Risk` — brand boundary.** Don't reproduce Notion's logo or imply official affiliation. Add "not affiliated with Notion" in the store listing and onboarding.

---

## 6. User flows

### Flow A — First-run setup

1. Install → onboarding page opens automatically.
2. **Step 1 — Create your Notion connection.** Inline guidance: "Open Notion → Settings → **Build → Internal connections → Create a new connection**. Name it 'Pesto', pick your workspace, save." Then: "Open the connection's **Configuration tab** and copy the **Installation Access Token** (starts with `ntn_…`). Paste it below." A capability hint sits next to the field: "Make sure your connection has **Read content + Insert content + Update content** enabled." (Phase 0 confirms exact UI surface for capability picking.)
3. **Step 2 — Share a Notion page with Pesto.** "Open the Notion page you want Pesto to use as the parent for your answer bank. Click the `…` menu in the top-right → `+ Add Connections` → pick 'Pesto' → confirm." This is the page that either holds your existing DB *or* is where Pesto will create one. The quickstart calls this out as the single most common cause of API failures, so onboarding emphasizes it.
4. **Step 3 — Where should your answer bank live?**
   - **(A) Connect existing database** — paste DB URL (the 32-char ID in the URL is what Pesto extracts). Pesto validates `Question` and `Answer` columns exist.
   - **(B) Create one for me** — user picks the shared parent page from a dropdown (populated via Notion search API restricted to pages the connection can access); Pesto calls `POST /v1/databases` with `parent: { type: "page_id", page_id: <id> }` and properties `{ Question: { title: {} }, Answer: { rich_text: {} } }`, seeded with one example row demonstrating the numbered-bullet format.
5. **Step 4 — Test connection.** Green confirmation with row count + DB name, or specific recoverable error.
6. **Step 5 — Pick trigger mode.** Three radio options:
   - **Auto on my sites** *(default — recommended)*: with a preview of the seeded allowlist (Greenhouse, Lever, Ashby, Workday, LinkedIn, Wellfound). User can untick any they don't want before continuing. On continue, Pesto fires `chrome.permissions.request` for each ticked site one by one (or in a single batch — see Q22 below). The user accepts each Chrome prompt to allowlist.
   - **Auto on all pages**: Pesto calls `chrome.permissions.request({origins: ["<all_urls>"]})` immediately; user accepts to enable Auto everywhere.
   - **Click-to-arm per tab**: no permissions needed beyond `activeTab`; user just clicks Continue.
7. **Step 6 — Brief explainer** of the in-field icon + the privacy model. If the user picked Mode 2, surface a "Manage allowlist" link to the app menu so they know where to add more sites later.

**Edge cases:**
- Token has insufficient capabilities → detect the specific Notion error code → tell the user to re-open the connection's Configuration / Capabilities tab and enable the missing one(s).
- Page not shared with connection (most common failure per the quickstart) → targeted recovery copy with screenshots of the `…` → `+ Add Connections` flow.
- Page URL pasted instead of DB URL (or vice versa) → detect and explain.
- `Question` or `Answer` column missing → block with fix instructions.
- Token revoked / refreshed in Notion → all flows degrade to "Reconnect Pesto" CTA in the in-field menu and toolbar.
- User on a workspace where they're not Workspace Owner → the quickstart notes you need Owner permission to create connections. Detect via the error and explain.

### Flow B — Recall & insert (primary flow)

1. User focuses a text input on any page (or, in click-to-arm mode, clicks the toolbar icon first to arm the tab).
2. Content script extracts and cleans the label; sends it to the worker.
3. Worker matches against the cached index; returns the best-matched Question's parsed answer options, plus a confidence.
4. **Pesto Dropdown Button** appears in the top-right corner inside the input (offset left if a PM icon is detected). Always shown when the field is focused and not suppressed.
5. User clicks the button → button enters **DropdownOpen** state → **Pesto Dropdown Menu** opens 10px below the input, width = input width (min 320px). Contents:
   - **"+ Save as new answer"** action (always present).
   - If a Question match exists: section header **Recents** (= parsed options of the matched Question, sorted by local last-used desc) → option rows.
   - If no match: menu uses the **Only Save Button** variant with an empty-state line below: "No saved answer for *‘{detected Question}’*."
6. On hover of an option row → **Answer Preview Tooltip** opens to the **left** of the row with the full text.
7. User clicks a row → text is inserted into the field; menu closes; button returns to default state. Local "last used" counter for that option bumps. No Notion write.
8. Clicking the button again toggles the menu closed.

**Append behavior (locked):**
- Empty field → insert directly.
- Field has user text → append with separator. Default: `\n` for `<textarea>` / `contenteditable`; `' '` for single-line `<input>`. **Q6 still open — confirm or change.**

**Insertion mechanics (critical):**
- Use the native value setter (`Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, newValue)`) then dispatch `input` and `change` events. Without this, React/Vue/Svelte-controlled inputs won't register the value and the form will submit empty.

**Edge cases:**
- Multiple matches of similar confidence → show all rows; never auto-insert silently.
- Sensitive fields → suppressed entirely.
- Dropdown near viewport edge → flip above the field when no room below; reposition on scroll/resize; close on scroll-away.
- Very narrow input → enforce min 320px width; right-anchor against the input's right edge.

### Flow C — Capture a new answer (and immediately insert it)

Entered when the user clicks "+ Save as new answer."

1. Inline expansion of the menu shows:
   - **Question** field — pre-filled with cleaned detected label, editable. Required.
   - **Answer** field — pre-filled with the field's current text, editable. Required.
2. The user clicks **Save**. There is **no pre-confirm dialog** for merges — the decision tree runs server-side in the worker and the user is informed via a toast after the fact.
3. Worker decision tree:
   - **No existing strong match** → `POST /v1/pages` to create a new row. `Question = {title}`, `Answer = "1. {new answer}"`. Toast: *"Saved as a new question."*
   - **Strong fuzzy match (≥0.85) AND merged `Answer` cell ≤ 2000 chars** → `PATCH /v1/pages/{id}`, appending `"\nN. {new answer}"` to the existing `Answer` rich_text. Question text untouched. Toast: *"Added as option N to '{matched Question}'."*
   - **Strong fuzzy match AND merged `Answer` cell would exceed 2000 chars** → **auto-fallback to creating a new row** via `POST /v1/pages` with the typed Question (or `{matched Question} (2)` if the typed Question is identical). Toast: *"That existing question's cell is full — saved as a new question instead."*
4. **Immediately after save succeeds:** worker returns the saved option; content script **inserts that answer into the focused field** (locked append behavior). Menu closes; toast appears.
5. Local cache is updated; next focus on a similar field will surface it instantly.

**Toast contract:** lives in the Shadow-DOM UI layer, auto-dismisses after ~4s, includes the action description and (for merge / fallback cases) the affected Question name. **Fire-and-forget — no Undo button** (locked v0.5). The Notion row is the source of truth; users edit/restore in Notion if needed.

**On failure:** preserve everything the user typed in the inline form; show specific error (network, rate limit, token revoked, missing Update capability).

**Edge cases:**
- Empty Question or Answer → inline validation, block save.
- Detected label was garbage ("Type here…") → editable Question field is the safety net; user fixes it before saving.
- Auto-fallback path produces a near-duplicate Question row in Notion. Document this — it can be cleaned up manually in Notion or via a future "merge duplicates" Phase 3 feature.
- Single typed answer > 2000 chars (even fresh, no merge) → hard-block at 2000 with inline validation.

### Flow D — Toolbar app menu

**State: not-connected**
- Token field + capability checklist explainer (Read, Insert, Update).
- Two buttons: **Connect existing database** (paste URL) and **Create one for me** (pick a shared parent page).
- Test Connection button.
- Privacy note: "Stored locally on this device. Never sent to a third party."

**State: connected**
- Connection status chip (green dot, "Connected to {DB name}").
- **Trigger mode** — three-way segmented control: Auto on all pages / Auto on my sites / Click-to-arm. Switching modes triggers the appropriate permission grant or revoke (§3.7).
- **My sites** (visible only when Mode 2 is active) — collapsible list of allowlisted domains. Each row: domain + status (Allowed / Revoked) + remove. **+ Add site** button at the bottom → small input where the user types a domain or pastes a URL → Pesto extracts the host, normalizes to `https://*.{host}/*`, fires `chrome.permissions.request`, Chrome shows its prompt, on accept the row appears as Allowed.
- **Recents** — global, local-only, max ~10 most-recently-inserted answers. Each row: option preview, **Copy** (clipboard), **Delete** icon (= trash icon glyph).
- Settings: Refresh cache, Clear cache, Lock (clears token from `chrome.storage.local`), Update token, About.

**Edge cases:**
- Recents references a row that no longer exists in Notion → on click, show "No longer in your Notion. Remove from Recents?"

### Flow E — Delete (option-only) with "Move to Notion trash" confirm

Per v0.3/v0.4: the row affordance is a standard trash icon (brand grey default, red on hover); the confirm dialog copy says "Move to Notion trash" (honest about what the API actually does). The trash icon is available in **both** the in-field menu rows AND the toolbar Recents rows.

1. User clicks the trash icon next to a row.
2. Confirm dialog:
   - **Title:** "Move to Notion trash?"
   - **Body:** "*‘{Question}’* → option {N}: ‘{first 60 chars…}’ will be moved to Notion's trash. You can restore it within 30 days from Notion."
   - Buttons: **Move to trash** (destructive red) / **Cancel**.
3. On confirm:
   - **If the Question row has more than one numbered option:** worker `PATCH /v1/pages/{id}` to rewrite the `Answer` rich_text minus that option, renumbering the remaining ones (`1. … 2. … 3. …`).
   - **If it's the last/only option:** worker `PATCH /v1/pages/{id}` with `in_trash: true` to archive the whole row.
4. Cache updated; both the in-field menu and toolbar Recents refresh.

**`⚠ Risk` — destructive affordance on the fast-flow surface.** Putting trash in the in-field menu makes accidental misfires easier (the in-field menu is the high-frequency surface during form-filling). Mitigations: (a) the confirm dialog is mandatory, (b) trash icon stays grey by default and only flips to red on hover so it doesn't read as "primary action," (c) the icon sits to the right of the row and is not the row's main click target — main click still inserts.

**`⚠ Risk` — renumbering after delete.** Option indices shift. Local "last used" tracking is keyed by Question ID + option text hash (not index), so a renumber doesn't break recency. Document this.

### Flow F — Activation per trigger mode

**Mode 1 (Auto on all pages):** content script is injected globally via `content_scripts` declared in manifest (active because `<all_urls>` is granted). User focuses input → in-field button appears. No additional gestures.

**Mode 2 (Auto on my sites):** content script is registered for the user's allowlisted origins only, via `chrome.scripting.registerContentScripts` (programmatic registration, updated whenever the allowlist changes). User visits an allowlisted site → focuses input → in-field button appears. User visits a non-allowlisted site → nothing happens (the toolbar app menu offers a "Add this site to allowlist" shortcut for the current tab).

**Mode 3 (Click-to-arm per tab):**
1. New page → nothing injected.
2. User clicks the Pesto toolbar icon → app menu opens; primary action is "**Arm this tab**." Clicking calls `chrome.scripting.executeScript` to inject the content script into the active tab (under `activeTab`'s gesture-attribution grant).
3. State persists for the tab until close or reload. No toolbar badge per v0.3.

### Flow G — Managing the allowlist (Mode 2)

1. User opens the toolbar app menu → "My sites" section.
2. **Adding a site:**
   - Either clicks "+ Add site" and types a domain, OR clicks "Add this site" shortcut if currently on a non-allowlisted page.
   - Pesto normalizes the input (strips protocol, paths, query) to `host`, builds the match pattern `https://*.{host}/*`.
   - Calls `chrome.permissions.request({origins: [pattern]})`.
   - Chrome shows its native permission prompt.
   - User accepts → row appears as Allowed; content script registers for that origin and starts working immediately (no reload required).
   - User declines → Pesto does not add the row (UI stays truthful).
3. **Removing a site:**
   - User clicks remove on a row → confirm dialog (allowlist removals are not destructive but worth confirming for predictability).
   - Pesto calls `chrome.permissions.remove({origins: [pattern]})` and unregisters the content script for that origin.
4. **External revocation:**
   - User revokes a permission via `chrome://extensions` → `chrome.permissions.onRemoved` fires → Pesto updates the row to "Revoked — click to re-grant" (clicking re-fires the request flow).

**Edge cases:**
- User pastes a full URL like `https://boards.greenhouse.io/stripe/jobs/123` → Pesto normalizes to `https://*.greenhouse.io/*`. Show a tooltip: "Pesto will run on all `greenhouse.io` pages, not just this one."
- User adds a top-level domain like `google.com` → Pesto warns: "This will run Pesto on every Google service. Continue?"
- User adds an IP address or localhost → blocked with explanatory error.
- Pattern conflicts (user adds `*.workday.com` after already having `myworkdayjobs.com`) → both stay; Chrome handles overlap natively.

---

## 7. Risks & critique (consolidated, v0.3)

**Privacy / security**
- Token unencrypted in `chrome.storage.local`. Lock/Clear control mitigates; never sync.
- Content script on all pages (Auto mode) is broad permission. Click-to-arm shrinks the surface.
- Hard suppression on password/payment/SSN-like fields is non-negotiable.
- Closed Shadow DOM so the host page can't read injected content via the DOM.
- Never auto-fill — human always clicks to insert.

**Technical**
- CORS → all calls via service worker.
- MV3 service workers ephemeral (~30s idle) → rehydrate cache from `chrome.storage.local` on wake.
- Notion ~3 req/s rate limit → serve reads from cache; debounce writes.
- Notion API versioning (databases vs. data sources) → pin `Notion-Version`, isolate behind an adapter.
- **`⚠`** Notion "delete" is archive/trash, not permanent erase — handled by Flow E copy.
- Numbered-bullet parsing brittle if user uses dashes / mixed numbering / missing space — validate gently and show a parse preview on save.
- Label extraction across SPA frameworks, host shadow DOMs, cross-origin iframes (cannot inject), canvas/custom inputs.
- Programmatic insertion not registering in framework-controlled inputs — fixed by native setter + event dispatch.

**UX / product**
- Setup friction (token + capabilities + create-vs-connect) is the top adoption killer. Onboarding must be exceptional.
- PM icon collision is real; offset + manual override required.
- Answer-bank pollution from bad auto-detected labels — editable Question field is the safety net.
- Renumbering after option delete shifts indices — last-used keyed by content hash, not index.
- Min-width on dropdown menu prevents unusable layouts on narrow inputs.

**Business / legal**
- Don't mimic Notion brand; "not affiliated with Notion" disclosure.
- Chrome Web Store will scrutinize host permissions; Click-to-arm option helps the review case.

---

## 8. Edge-case catalog

- Two inputs, one shared label (first/last name) → per-input memory of last-used.
- Floating-label UIs (Material) where the label *is* the placeholder until focus.
- Cross-origin iframes (Greenhouse/Lever widgets) — can't inject; documented limitation.
- Dynamically injected fields (multi-step forms) → `MutationObserver`.
- Long essay answers → 2000-char cap; warn + block.
- Numbered-bullet parsing edges: mixed markers ("1.", "1)", "•", "-") — only `N. ` parses; multi-line inside a bullet supported; single un-numbered cell = one option.
- Renumbering after option delete (Flow E).
- Merge-into-existing-row pushes `Answer` cell over 2000 chars (Flow C).
- RTL / non-Latin text in both Question and Answer.
- User renames a required column → schema validation error.
- Thousands of rows → pagination + cache + matching performance pass.
- Offline / Notion down → reads from cache; saves queue or fail loudly.
- Multiple Chrome profiles / Notion workspaces — single workspace per token; documented.
- `maxlength` shorter than answer → truncate visually; warn after insert.
- Clipboard write permission prompt on first Copy from Recents.
- Very narrow inputs → min 320px menu + right-anchor against input.
- Click-to-arm: tab reloaded → unarmed → next focus does nothing; discoverable only via app menu.

---

## 9. Phased build plan

### Phase 0 — Spike & de-risk (1 week)
- Service-worker → Notion call past CORS with installation access token (Read, Insert, Update); raw `fetch` not the SDK.
- **Verify current Notion connection UI** — exact location of capability checkboxes and exact error code shape when a request is rejected for missing capability.
- **Verify create-a-database round-trip** end-to-end: user shares a parent page, Pesto calls `POST /v1/databases`, validates the schema, immediately writes a seed row, reads it back.
- Label extraction across 15–20 real job forms (Greenhouse, Lever, Workday, Ashby, LinkedIn, plain HTML).
- Native-setter insertion confirmed on React/Vue/Svelte test cases.
- Numbered-bullet parser round-trip (read → render → save → re-read), with alias-split on `|`.

### Phase 1 — MVP
- Onboarding: token + capability checklist + create-OR-connect DB + Test Connection + mode pick.
- Service worker: query DB (paginated), POST page, POST database (create-for-me), PATCH page (option-delete renumber + archive last option + merge-as-new-option).
- Content script: focus detection, label extraction (tiers 1–6), Pesto Dropdown Button with PM-collision left-shift, Pesto Dropdown Menu (Shadow DOM, dynamic width with 320px min), Answer Preview Tooltip on hover, append-on-insert with native event dispatch, sensitive-field suppression.
- Save flow with editable Question, immediate auto-insert after save, length guard, merge detection.
- Matching tiers 1 (exact normalized) + 2 (fuzzy) — both expanded over pipe-split alias tokens per row.
- Toolbar app menu: connection setup, three-way mode toggle, **My sites allowlist** (add/remove with native Chrome permission prompts; programmatic content-script registration via `chrome.scripting.registerContentScripts`; revocation detection via `chrome.permissions.onRemoved`), global Recents (copy, delete-with-confirm), connection status.
- `optional_host_permissions` manifest field declared; runtime permission requests in onboarding (Mode 1) and in the allowlist add flow (Mode 2).
- Visual: implement the three Figma components and the app menu per §13 specs.
**Exit:** end-to-end on 5 real forms with name/email/phone + 3 new saves (including one merge-as-new-option case + one option-delete), zero data leaves browser/Notion.

### Phase 2 — Match quality + polish
- Better PM-collision coverage; per-site icon offset and per-site disable.
- Edge-case menu positioning hardening.
- Per-input "last used" recall for ambiguous fields.
- Fuzzy-threshold tuning based on Phase 1 hit-rate data.

### Phase 3 — Smart matching + reach
- On-device semantic matching via `transformers.js` as opt-in (handles paraphrased questions the alias list doesn't cover).
- "Learn this phrasing as an alias" — when a user rejects a high-fuzzy match and picks a different row (or saves new), offer to add the detected label to the chosen row's alias list automatically (one-tap).
- Optional "merge duplicates" assistant.
- Long-answer page-body fallback.
- A11y pass (keyboard nav, screen reader, WCAG AA).
- Performance on large answer banks.

### Phase 4 — Hardening & store submission
- Privacy policy + Web Store listing + permission justification.
- Edge-case hardening (dynamic forms, iframes documentation, framework input compatibility).
- Stretch: `<select>` / radio / checkbox, Firefox, multiple Notion DBs.

---

## 10. Open questions

| # | Question | Why it matters |
|---|---|---|
| Q22 | During onboarding Mode 2 setup, when the user picks N allowlisted sites, do we fire N **sequential** Chrome permission prompts (clearer per-site consent, more clicks) OR a single **batch** prompt for all origins at once (one click, less granular)? Chrome supports both. Recommend batch with a "click each site to toggle" UI before the single Continue button. | Onboarding friction vs. consent granularity. |

Phase 0 spike will surface more questions, particularly around label extraction quality on real forms and password-manager DOM signatures we haven't catalogued — those will become v1.4.

---

## 11. References

**Notion**
- **Notion Developer Quickstart** — https://developers.notion.com/guides/get-started/quick-start. Canonical setup walkthrough; source of v1.1 terminology updates.
- **Notion API — page property values** — https://developers.notion.com/reference/page-property-values. Authoritative for `title`, `rich_text` shapes used in our schema.
- **Notion API — Create a database** — https://developers.notion.com/reference/create-a-database. Used by Path B in onboarding (create-DB-for-me).
- **Notion API limits** — ~3 req/s, 2000-char rich_text cap.
- **Notion API versioning** — every request must include a pinned `Notion-Version` header.
- **Notion JS SDK** (`@notionhq/client`) — not used (raw `fetch` in the service worker, see §3.2). Reference only.
- **Live source-of-truth DB** — `Pesto Blocks Database` → embedded `Q&A` database, schema: `Question` (title) / `Answer` (rich_text) / `Status` (status, ignored). Title column was briefly "Name" during initial setup; renamed to "Question" to match the canonical spec.

**Chrome**
- **Extensions Get Started** — https://developer.chrome.com/docs/extensions/get-started. Conceptual overview of manifest, service workers, content scripts, toolbar action, side panel.
- **Handle events with service workers (tutorial)** — https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events. Source of the SW lifecycle rules in §3.6 (top-level listener registration, ES-module SW, `chrome.alarms`, no globals, `chrome.storage` for state).
- **Build extensions with coding agents** — https://developer.chrome.com/docs/extensions/ai/build-with-ai. Source of §14 (Modern Web Guidance / chrome-extensions skill + Chrome DevTools for agents).
- **Chrome Web Store program policies** — https://developer.chrome.com/docs/webstore/program-policies. Permission justifications, single-purpose policy, privacy disclosures (matters at submission).

**Other**
- **Bird Eats Bug — Build a Chrome extension with Notion API** — useful scaffold for API call shapes (we deliberately skip their OAuth + backend).

---

## 12. Naming

Working name: **Pesto** (confirmed via Figma component prefix). Verify no Notion trademark conflict in name or icon before store submission.

---

## 13. Component specifications — locked from Figma

All values below are pulled directly from the Figma file (Portfolio-Website, components 5527-3973 / 5514-3775 / 5514-3815).

### 13.1 Design tokens

| Token | Value |
|---|---|
| `--pesto-green` | `#538700` (primary chevron half, logo bars in default) |
| `--pesto-green-hover` | `#457100` (chevron half + logo bars on hover / open-hover) |
| `--pesto-green-pale` | `#ebf3dd` (logo half background) |
| `--pesto-surface` | `#ffffff` (menu background) |
| `--pesto-tooltip-bg` | `#0e0e0e` |
| `--pesto-text-strong` | `#2c2c2b` (Save row text, primary copy) |
| `--pesto-text-weak` | `#73726e` (option row text — Figma `var(--foreground-weak)`) |
| `--pesto-text-muted` | `#7e7a76` (Recents label) |
| `--pesto-tooltip-text` | `#ffffff` (Figma `var(--primary/fg)`) |
| `--pesto-radius-base` | `6px` |
| `--pesto-radius-dialog` | `10px` |
| `--pesto-radius-button-corner` | `5px` (outer corners of button halves) |
| `--pesto-spacer-200` | `4px` |
| `--pesto-spacer-600` | `12px` |
| `--pesto-shadow-dialog` | `0px 0px 0px 1px rgba(84,72,49,0.08), 0px 2px 4px -1px rgba(0,0,0,0.06), 0px 14px 28px -6px rgba(0,0,0,0.1)` |
| `--pesto-destructive-red` | `#D44C47` *(placeholder — confirm in Figma if a destructive token exists)* |

### 13.2 Typography (SF Pro Text, fall back to system UI)

| Style | Spec |
|---|---|
| Body Small Medium (Save row, option rows) | SF Pro Text **Medium 500**, 14 / 20, letter-spacing −0.56 (−0.04em) |
| Recents label | SF Pro Text **Semibold 600**, 12 / 16, letter-spacing −0.48 |
| Tooltip body | SF Pro Text **Medium 500**, 12 / 20, letter-spacing −0.48 |

### 13.3 Pesto Dropdown Button (`5527:3972` + variants)

- **Structure:** two pill halves side-by-side, sharing a 5px outer radius (no inner radius between them).
- **Left half (Logo):** background `--pesto-green-pale`; padded 3px; contains a 14px Pesto Blocks Logo rendered in two stacked rounded rects (`5.216 × 8.235` and `5.216 × 4.392`), filled `--pesto-green` (default/open) or `--pesto-green-hover` (hover/open-hover); 2px corner radius on each bar.
- **Right half (Chevron):** background `--pesto-green` (default/open-default) or `--pesto-green-hover` (any hover); padded 3px; 14px `mingcute:down-line` glyph.
  - **State = Default:** chevron rotated −90° (points right).
  - **State = DropdownOpen:** chevron points down (no rotation).
  - **Hover variants** mirror the Default and DropdownOpen geometries with the hover green.
- **Height:** 20px total; outer radius 5px on the outer corners only.
- **Hit area:** the whole 2-half element is clickable; rendered button uses `cursor: pointer` on hover states.

### 13.4 Pesto Dropdown Menu (`5510:3639` and `5549:4076`)

- **Variants:**
  - **`Save Button + Dropdown Answers`** — when a Question match exists.
  - **`Only Save Button`** — when no match exists.
- **Container:**
  - Background `--pesto-surface`.
  - Border-radius `--pesto-radius-dialog` (10px).
  - Shadow `--pesto-shadow-dialog`.
  - Width: **412px in Figma**, but in product, render at **input.width** with `min-width: 320px`. Use the 412px Figma width as the canonical "designed-for" size when previewing the component in isolation; production behavior is dynamic.
  - Padding: 4px all around (`--pesto-spacer-200`).
- **Save row ("+ Save as new answer"):**
  - Height 32px, padding `4px 8px 5px 8px`, gap 7px, radius `--pesto-radius-base`.
  - Left: 20×20 icon container holding a 14px Plus glyph.
  - Right: text "Save as new answer" in Body Small Medium, color `--pesto-text-strong`.
- **Recents label** (only in the `with answers` variant):
  - "Recents", 12/16 Semibold, color `--pesto-text-muted`.
  - Padding: 5px top, 12px horizontal (`--pesto-spacer-600`), wrapping a 24px-high container.
- **Option row:**
  - Height 32px, padding `4px 8px 5px 8px`, gap 7px, radius `--pesto-radius-base`.
  - **Left:** 20×20 icon container holding the 14px **edit (pencil)** icon. **No-op for v1** per your decision.
  - **Middle:** option text, Body Small Medium, color `--pesto-text-weak`, single line with ellipsis on overflow. Container `flex: 1 0 0`. The middle area is the row's primary click target → inserts on click.
  - **Right (icon cluster, revealed on row hover or keyboard-focus):**
    - 20×20 container with the 14px **enter / return** icon → indicates "insert on click" (clicking the icon or the row triggers insert).
    - 20×20 container with the 14px **trash** icon → opens the Move-to-Notion-trash confirm dialog (§Flow E).
    - Icons sit side-by-side with no extra spacer beyond the existing 7px row gap.
  - The trash icon has its own click target; clicking it does *not* trigger insert (`stopPropagation`).
- **Active state:** the row currently being hovered or keyboard-focused reveals the enter + trash icon cluster on the right; non-active rows show nothing on the right.
- **Empty state (Only Save Button variant):** no Recents label, no rows; only the Save row. Show an inline secondary copy line beneath: "No saved answer for *‘{Question}’*."

### 13.5 Answer Preview Tooltip (`5514:3815`)

- Background `--pesto-tooltip-bg`, color `--pesto-tooltip-text`.
- Border-radius `--pesto-radius-base` (6px).
- Width: **318px fixed**.
- Padding: 8px vertical, 9px horizontal.
- Typography: Tooltip body (SF Pro Text Medium 12/20, −0.48 tracking).
- **Position:** anchored to the **left** of the hovered option row, vertically aligned to the row's top.
- Word-break: `break-word`; multi-line; preserves line breaks from the source option.
- Hide on: mouseout, row selection, menu close.

### 13.6 Toolbar app menu

Composed from the same primitives:

- Outer container = Pesto Dropdown Menu surface (412px width, dialog radius and shadow).
- Row style for Recents, settings, and connection items inherits the option-row pattern (32px height, 6px radius, `--pesto-text-strong` for primary actions, `--pesto-text-weak` for secondary).
- Section headers use the Recents-label style.
- Trigger-mode toggle: a segmented control inside a single row, using `--pesto-green` for the active segment.
- Delete icon (in both toolbar Recents rows AND in-field menu rows): standard 14px trash glyph, **default color `--pesto-text-weak` (brand grey), hover color `--pesto-destructive-red`** (`#D44C47` placeholder — `↳ confirm exact red in Figma if a destructive token exists`). The icon has its own click target; click triggers the Move-to-Notion-trash confirm dialog.

---

---

## 14. Build-agent setup (Claude Code)

**`🔧 Decision`** Build the extension with Claude Code, using the **Chrome team's `chrome-extensions` skill** from the Modern Web Guidance pack (you've already enabled this — confirmed). This skill is the canonical source for current Chrome extension APIs, best practices, and Chrome Web Store submission metadata, and is maintained by the Chrome DevRel team.

**What the skill does for the build:**
- Keeps the agent grounded in current MV3 APIs (some shipped after the model's training cutoff).
- Enforces Chrome team best practices (e.g., the SW lifecycle rules in §3.6 — top-level listeners, `chrome.alarms` not `setTimeout`, no globals).
- Maintains a **`CHROMEWEBSTORE.md`** file that tracks per-permission justifications as the codebase grows. We'll have this file populated by submission time so the Developer Dashboard fill-in is largely copy-paste.

**Setup confirmed for Claude Code (per the Chrome docs):**

```bash
npx modern-web-guidance@latest install --choose
# select: chrome-extensions + modern-web-guidance
```

**Recommended addition to `~/.claude/CLAUDE.md` (per the Chrome docs):**

```
Whenever you are creating or making changes to a Chrome extension, create and manage a CHROMEWEBSTORE.md file. You can use the chrome-extensions skill to learn about the format of this file.
```

**Also recommended — Chrome DevTools MCP for testing:** lets the agent install/uninstall/reload the extension in a real Chrome instance, trigger actions, and inspect popup / SW / side panel during build. Install in Claude Code with:

```bash
claude mcp add chrome-devtools --scope project -- npx chrome-devtools-mcp@latest --categoryExtensions
```

This closes the build → test loop without leaving the chat interface — particularly valuable for the label-extraction Phase 0 spike, where the agent can navigate to real job forms, watch our content script, and iterate.

**Reference these in build sessions:** when starting a build session, point Claude at this PRD plus the chrome-extensions skill, and the agent will know to consult the skill for MV3 specifics rather than relying on possibly-stale training knowledge.

---

*End of v1.3. Trigger model expanded to three modes with the `optional_host_permissions` pattern. Default mode (Auto on my sites, seeded ATS allowlist) is purpose-built for the job-seeker use case. Only Q22 (sequential vs. batch permission prompts in onboarding) is open; defaulting to batch unless you say otherwise. Build-ready.*
