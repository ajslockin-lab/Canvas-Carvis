# Carvis — Deployment Checklist

## Before first deploy

### 1. Generate secrets

**Encryption key** (used for AES-256-GCM encryption of Canvas access tokens at rest):

```bash
openssl rand -hex 32
```

Copy the output. It must be exactly 64 hex characters. This is your `ENCRYPTION_KEY`.

### 2. Set environment variables in Vercel

Go to **Project Settings → Environment Variables** and add all five:

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | 64-char hex string from step 1. Never share, never commit. |
| `SESSION_SECRET` | A separate random secret for signing session cookies. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | Postgres connection string for your production database. |
| `CANVAS_CLIENT_ID` | From your Canvas LMS developer key (needed only for OAuth flow; PAT auth works without it). |
| `CANVAS_CLIENT_SECRET` | From your Canvas LMS developer key. Same caveat as above. |
| `DEMO_MODE` | Set to `true` to serve hardcoded seed data (fake user "Alex Rivera", 4 courses, plausible assignments). No real Canvas or database access — safe for a public portfolio URL. Omit or set to `false` for production. |

`APP_URL` (optional but recommended) should be set to your production domain so OAuth redirect URIs resolve correctly, e.g. `https://carvis.vercel.app`.

> **If `CANVAS_CLIENT_ID` or `CANVAS_CLIENT_SECRET` was ever committed to git** — even briefly, even in a private repo — rotate them immediately in your Canvas developer key settings before deploying. Treat any secret that touched git history as compromised.

### 3. Push the schema to the production database

Before the first deploy, apply the Drizzle schema to your production Postgres instance:

```bash
DATABASE_URL=<your-production-url> pnpm --filter @workspace/db run push
```

Drizzle's `push` command diffs against the live schema and applies only what's missing. Run it once before deploying, and again any time you add tables or columns.

### 4. Deploy

```bash
vercel --prod
```

The `vercel.json` at the repo root routes `/api/*` to the Express serverless function and everything else to the Vite static build. No additional config needed.

---

## Chrome extension

The Chrome extension (background/content script for voice commands on Canvas pages) is **not included in the Vercel deploy**. It requires a separate manual submission:

1. Zip the extension source directory.
2. Submit to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Set the extension's API base URL to your deployed Vercel domain before packaging.

There is no automated deploy script for the extension — CWS review is manual and submissions require a developer account.

---

## Ongoing

- **Rotate `ENCRYPTION_KEY` with care.** Rotating it invalidates all existing encrypted Canvas tokens in the database (users will need to re-authenticate). If you rotate, clear the `canvas_access_token_encrypted` column before redeploying.
- **`GROQ_API_KEY`** (optional): add this if you want live NLU intent classification via Groq's Llama 3 API. Without it, voice commands fall back to keyword-based responses — functional but not AI-powered.
- **Voice input** requires mic permissions on the deployed origin — it won't work in the Replit preview iframe, open the deployed URL directly to test.
- Production schema changes are applied via Vercel's publish flow (Replit) or `drizzle-kit push` with the production `DATABASE_URL`. Do not add startup-time DDL to the app code.
