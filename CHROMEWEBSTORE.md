# Chrome Web Store Listing — Pesto

> Last Updated: 2026-05-31

## Store Listing

**Extension Name**
Pesto

**Short Description**
Autofill job application forms from your Notion answer bank. One click to insert, one click to save.

**Detailed Description**
Pesto connects your Notion database to job application forms. When you focus a text input, Pesto matches the field label against your saved Question/Answer pairs and shows matching answers in a dropdown. One click inserts the answer. One click saves a new answer.

How it works:
1. Create a Notion integration and share a database with two columns: Question (title) and Answer (text).
2. Install Pesto and connect it to your Notion database during onboarding.
3. Visit a job application form. Focus any text field to see Pesto's button appear inside the input.
4. Click the button to see saved answers. Click an answer to insert it.
5. Type a new answer and click Save to store it back to your Notion database for next time.

Key features:
- Fuzzy matching finds answers even when field labels differ between job sites
- Pipe-delimited aliases let one answer match multiple question variations (e.g. "Full name | Your name | Name")
- Numbered options in a single Answer cell let you store multiple versions of an answer
- Three trigger modes: auto on all sites, auto on allowlisted sites only, or click-to-activate per tab
- Works with Greenhouse, Lever, Ashby, Workday, LinkedIn, Wellfound, and any standard HTML form
- Shadow DOM UI ensures Pesto never breaks the host page's styles

Privacy and data:
Pesto communicates only with your own Notion workspace via the Notion API. No data is sent to any other server. No analytics, no telemetry, no tracking. Your Notion token is stored locally in chrome.storage and never leaves your browser except to authenticate with api.notion.com.

Pesto is not created by, affiliated with, or supported by Notion Labs, Inc.

For support or feedback, open an issue on GitHub.

**Category**
Productivity

**Single Purpose**
Autofills job application form fields from a user-owned Notion database of saved answers.

**Primary Language**
English


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128x128 PNG | ✅ Ready | src/icons/icon-128.png |
| Screenshot 1 | 1280x800 or 640x400 | ⬜ Not created | |
| Screenshot 2 | 1280x800 or 640x400 | ⬜ Not created | |
| Screenshot 3 | 1280x800 or 640x400 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Pesto dropdown open on a Greenhouse job application form, showing matched answers
- Screenshot 2: The save form expanded, showing how a new answer is saved back to Notion
- Screenshot 3: The popup connected state showing trigger mode selection and allowlisted sites


## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Stores the user's Notion API token, database ID, trigger mode preference, site allowlist, cached answers, and recent insertions locally. All data stays on the user's device. |
| `alarms` | permissions | Schedules periodic cache expiration checks (every 10 minutes) so the cached copy of Notion answers stays fresh without manual refreshing. |
| `scripting` | permissions | Programmatically injects the content script into web pages based on the user's chosen trigger mode. In "allowlist" mode, scripts are registered only for user-approved domains. In "click-to-arm" mode, the script is injected into the active tab on demand. |
| `activeTab` | permissions | Grants temporary access to the currently active tab when the user clicks the Pesto toolbar icon or uses the "Arm this tab" button. This allows content script injection without requesting broad host permissions upfront. |
| `https://api.notion.com/*` | host_permissions | Required to query, create, update, and archive rows in the user's Notion database. Pesto calls the Notion API to fetch saved answers, save new answers, and manage the user's answer bank. No other external server is contacted. |
| `<all_urls>` | optional_host_permissions | Only requested if the user selects "Auto (all sites)" trigger mode or adds specific sites to their allowlist. Allows the content script to run on job application forms across different domains. The user explicitly grants this permission at runtime via a Chrome permission prompt. |


## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

Pesto does not collect, transmit, or share any user data with Pesto's developers or any third party.

The extension stores the following locally in chrome.storage:
- Notion API token (entered by the user)
- Notion database ID
- Cached copy of the user's Notion answers (auto-expires after 10 minutes)
- Trigger mode preference and site allowlist
- Recent insertion history (up to 10 entries)

The only external communication is between the user's browser and the Notion API (api.notion.com) using the user's own API token to access their own Notion workspace.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | No | No | — | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL**
<!-- Host at a publicly accessible URL before submission. -->


## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free


## Developer Info

**Publisher Name**
<!-- Your name or organization -->

**Contact Email**
<!-- Your public contact email -->

**Support URL / Email**
<!-- GitHub Issues page or support email -->

**Homepage URL**
<!-- Project homepage or GitHub repo URL -->


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-05-31 | Initial release — Notion connection, form autofill, save new answers, fuzzy matching, three trigger modes, onboarding wizard | Draft |


## Review Notes

### Known Issues / Limitations
- Icons are programmatically generated placeholders; replace with designed assets before store submission
- Screenshots need to be captured from the running extension before submission
- Privacy policy URL needs to be hosted before submission
- The extension requires users to create their own Notion integration; it does not use OAuth
