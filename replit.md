# Carvis

An AI-powered Canvas LMS assistant that lets students sync their courses, assignments, and grades, then query everything via a voice interface backed by Groq LLaMA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/carvis run dev` — run the frontend (port 23877)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Secrets

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `ENCRYPTION_KEY` — 64-char hex string (32 bytes) used for AES-256-GCM encryption of Canvas tokens at rest
- `SESSION_SECRET` — session signing secret (already set)
- `GROQ_API_KEY` — Groq API key for voice NLU (llama-3.1-8b-instant); voice falls back to rule-based if absent
- `CANVAS_CLIENT_ID` / `CANVAS_CLIENT_SECRET` — optional, only needed for Canvas OAuth flow (PAT auth works without)
- `APP_URL` — optional, base URL for OAuth redirect (e.g. `https://your-app.replit.app`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, Tailwind CSS v4, Three.js (particle orb), wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- NLU: Groq SDK (llama-3.1-8b-instant) with rule-based fallback
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/carvis.ts` — Drizzle table definitions (users, courses, assignments, grades, conversations, sessions)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, canvas, user, voice, extension)
- `artifacts/api-server/src/lib/` — crypto (AES-256-GCM), auth middleware, canvas-fetch, nlu (Groq)
- `artifacts/carvis/src/lib/carvisOrb.ts` — Three.js particle orb (2000 particles, 4 states)
- `artifacts/carvis/src/components/OrbCanvas.tsx` — React wrapper for the orb
- `artifacts/carvis/src/components/VoiceInterface.tsx` — Web Speech API + voice command UI

## Architecture decisions

- Canvas tokens are encrypted at rest (AES-256-GCM, key from `ENCRYPTION_KEY` env var) before storing in DB
- Sessions use a custom httpOnly `carvis_session` cookie (30-day TTL) stored in the `sessions` table; no JWT
- Course/assignment IDs are scoped as `{userId}__c{canvasId}` / `{courseId}__a{assignmentId}` to prevent cross-user collisions
- Voice NLU uses Groq (llama-3.1-8b-instant) with a rule-based fallback — voice still works without a GROQ_API_KEY
- The Three.js orb fails gracefully when WebGL is unavailable (Replit preview sandbox) — app renders normally without it

## Product

- Canvas PAT or OAuth sign-in — connects to any Canvas LMS institution
- Full course/assignment/grade sync from Canvas API
- Dashboard: upcoming, overdue, completed assignment counts, grade averages, next-due item
- Voice command interface: speak queries, get AI responses, orb animates through idle/listening/thinking/speaking states
- Chrome extension agent endpoint for navigating Canvas pages by voice
- Assignment completion toggle (local tracking)

## Gotchas

- The Replit preview iframe cannot run WebGL — the Three.js orb will show as a blank canvas there, but works in a real browser tab or deployed app
- Canvas URL must match `https://<school>.instructure.com` exactly (enforced server-side)
- After any DB schema change: run `pnpm --filter @workspace/db run push`
- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen`
- `pnpm run typecheck` builds libs first, then checks leaf packages — trust this over editor LSP if they disagree

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
