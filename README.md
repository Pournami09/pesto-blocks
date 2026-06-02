# Pesto Blocks

A Chrome extension that autofills job application forms using your own Notion database. Focus any text input on a job board and Pesto matches it against your saved Question/Answer pairs, letting you insert answers with one click or save new ones on the fly.

## How it works

1. **Connect** your Notion workspace via an integration token
2. **Create or link** a database with `Question` (title) and `Answer` (rich text) columns
3. **Focus** any text input on a supported job board — Pesto detects the field label, matches it against your database, and shows a dropdown with saved answers
4. **Insert** an answer with one click, or **save** a new one directly from the form

Multiple answer variants for the same question are separated by `---` in the Notion cell.

## Features

- Fuzzy label matching (Jaro-Winkler + Dice coefficient) across question aliases
- Shadow DOM isolation — Pesto's UI never conflicts with host page styles
- Three trigger modes: All pages, Allowlisted sites, or Click-to-arm
- Password manager collision detection (1Password, Bitwarden, LastPass, Dashlane)
- Suppresses sensitive fields (passwords, credit cards, SSNs)
- Save with undo — one-click save with toast notification and undo button
- Real-time sync — always fetches latest data from your Notion database
- All data stays between your browser and your own Notion workspace — no backend, no telemetry

## Setup

```bash
npm install
npm run build
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions` (enable Developer mode).

## Project structure

```
src/
├── service-worker.js        # Background service worker (message router)
├── lib/
│   ├── constants.js          # Message types, storage keys, config
│   ├── notion-api.js         # Notion API wrapper
│   ├── parser.js             # Answer variant parser (--- separator)
│   ├── matcher.js            # Fuzzy matching engine
│   ├── cache.js              # chrome.storage.local cache
│   └── permissions.js        # Permission request helpers
├── content/
│   ├── index.js              # Content script orchestrator
│   ├── label-extractor.js    # 7-tier label extraction from DOM
│   ├── field-detector.js     # Focus detection + suppression
│   ├── pm-detector.js        # Password manager collision detection
│   ├── inserter.js           # Native value setter + event dispatch
│   └── ui/
│       ├── shadow-host.js    # Closed Shadow DOM host
│       ├── styles.js         # CSS design tokens
│       ├── dropdown-button.js
│       ├── dropdown-menu.js
│       ├── tooltip.js
│       ├── toast.js
│       └── confirm-dialog.js
├── popup/                    # Toolbar popup
└── onboarding/               # First-install onboarding wizard
```

## License

MIT
