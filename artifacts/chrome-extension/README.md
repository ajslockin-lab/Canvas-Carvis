# Carvis Chrome Extension

Voice commands and live navigation assistance for Canvas LMS, powered by the Carvis AI backend.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder
5. The Carvis icon will appear in your toolbar

## Setup

1. Open the **Carvis web app** and sign in with your Canvas PAT
2. Click the Carvis extension icon
3. If prompted, open the Carvis app to authenticate — the extension reads your session from the API

> **Self-hosted?** Click **Settings** in the popup and update the Carvis App URL to your deployment.

## What it does

- **Type or speak commands** while on any Canvas page (*.instructure.com)
- **Navigation** — "open assignments", "go to grades", "open modules"
- **Search** — "search for midterm"
- **Scroll** — "scroll down / scroll up"
- **Safety** — automatically blocks risky actions (submit, delete, start quiz) and explains why
- **Dashboard stats** — shows upcoming due, overdue, and grade average in the popup
- **Canvas toast** — responses appear as an overlay on the Canvas page itself

## Permissions

| Permission | Why |
|---|---|
| `storage` | Store your Carvis session token and API URL |
| `activeTab` | Read the current Canvas tab's DOM to find clickable elements |
| `scripting` | Inject the content script if not yet active |
| `host_permissions: *.instructure.com` | Limit content script to Canvas pages only |

## Privacy

The extension sends only the page's interactive element list (link text, button labels, input placeholders — no page body content or personal data) plus your typed command to the Carvis API. No data is sent to third parties.
