---
name: Carvis session authentication
description: How auth works — httpOnly cookie sessions, no JWT, requireAuth helper pattern.
---

## Session system
- Cookie name: `carvis_session` (httpOnly, SameSite=lax, 30-day TTL)
- Sessions stored in `sessions` table with `expires_at` timestamp
- Extension token alternative: `x-session-token` header (for Chrome extension)
- Helper: `requireAuth(req, res)` in `artifacts/api-server/src/lib/auth.ts` — returns `AuthedUser | null`, sends 401 and returns null on failure

## Usage pattern in routes
```typescript
const user = await requireAuth(req, res);
if (!user) return; // 401 already sent
```

**Why:** Simpler than JWT for a first-party web app. No refresh token complexity. Sessions table lets us invalidate server-side.

**How to apply:** Every protected route must call `requireAuth` and guard with `if (!user) return`. Never skip the null check.
