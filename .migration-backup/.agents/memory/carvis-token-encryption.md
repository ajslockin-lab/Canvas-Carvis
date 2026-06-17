---
name: Carvis token encryption & ID scoping
description: How Canvas tokens are stored and how DB IDs are namespaced to prevent cross-user collisions.
---

## Token encryption
- Algorithm: AES-256-GCM
- Key source: `ENCRYPTION_KEY` env var (hex-encoded 32 bytes / 64 chars)
- Format stored in DB: `base64(iv):base64(ciphertext):base64(authTag)`
- Utility: `artifacts/api-server/src/lib/crypto.ts` — `encrypt(plaintext)` / `decrypt(ciphertext)`

**Why:** Canvas PATs are long-lived credentials. Storing them in plaintext would be a critical data breach if the DB is compromised.

## ID scoping
- Course IDs: `{userId}__c{canvasId}` (e.g. `canvas_12345__c67890`)
- Assignment IDs: `{scopedCourseId}__a{canvasAssignmentId}`

**Why:** Canvas course/assignment IDs are institution-scoped integers that repeat across users. Without namespacing, user A's course `123` would collide with user B's course `123` in the DB.

**How to apply:** Always use `scopedCourseId()` and `scopedAssignmentId()` helpers in `artifacts/api-server/src/routes/canvas.ts` when syncing. Never store raw Canvas integer IDs as primary keys.
