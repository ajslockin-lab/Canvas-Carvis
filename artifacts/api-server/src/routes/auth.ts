import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt } from "../lib/crypto.js";
import { fetchCanvasUser } from "../lib/canvas-fetch.js";
import { AuthCanvasPatBody, AuthCanvasOauthStartBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionCookie(res: import("express").Response, sessionId: string) {
  res.cookie("carvis_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export const VALIDATE_CANVAS_URL = /^https:\/\/[a-zA-Z0-9-]+\.instructure\.com$/;

router.post("/auth/canvas/pat", async (req, res): Promise<void> => {
  const parsed = AuthCanvasPatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const { canvasUrl, pat } = parsed.data;

  if (!VALIDATE_CANVAS_URL.test(canvasUrl)) {
    res.status(400).json({ error: "Must be a valid Canvas URL (https://school.instructure.com)" });
    return;
  }

  try {
    const canvasUser = await fetchCanvasUser(pat, canvasUrl);
    const email = canvasUser.primary_email || canvasUser.login_id || `canvas_${canvasUser.id}@carvis.local`;
    const userId = `canvas_${canvasUser.id}`;

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const encryptedToken = encrypt(pat);
    const userData = {
      email,
      name: canvasUser.name || null,
      canvasBaseUrl: canvasUrl,
      canvasAccessTokenEncrypted: encryptedToken,
      canvasUserId: String(canvasUser.id),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(usersTable).set(userData).where(eq(usersTable.id, userId));
    } else {
      await db.insert(usersTable).values({ id: userId, ...userData });
    }

    const sessionId = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(sessionsTable).values({ id: sessionId, userId, expiresAt });

    createSessionCookie(res, sessionId);
    res.json({ success: true, user: { id: userId, email, name: canvasUser.name || null, canvasBaseUrl: canvasUrl } });
  } catch (err) {
    req.log.error({ err }, "Canvas PAT auth error");
    res.status(400).json({ error: "Could not connect to Canvas — check your URL and access token" });
  }
});

router.post("/auth/canvas/start", async (req, res): Promise<void> => {
  const parsed = AuthCanvasOauthStartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const { canvasUrl } = parsed.data;
  const clientId = process.env["CANVAS_CLIENT_ID"];
  if (!clientId) {
    res.status(400).json({ error: "OAuth not configured — use PAT authentication instead" });
    return;
  }

  const state = randomBytes(16).toString("hex");
  const appUrl = process.env["APP_URL"] || "";
  const redirectUri = `${appUrl}/api/auth/canvas`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  res.cookie("canvas_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600_000, path: "/" });
  res.cookie("canvas_oauth_url", canvasUrl, { httpOnly: true, sameSite: "lax", maxAge: 600_000, path: "/" });
  res.json({ url: `${canvasUrl}/login/oauth2/auth?${params.toString()}` });
});

router.get("/auth/canvas", async (req, res): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;
  const reqWithCookies = req as import("express").Request & { cookies: Record<string, string> };
  const cookies = reqWithCookies.cookies ?? {};
  const storedState = cookies["canvas_oauth_state"];
  const canvasUrl = cookies["canvas_oauth_url"];
  const appUrl = process.env["APP_URL"] || "";

  if (oauthError) {
    res.redirect(`${appUrl}/signin?error=${encodeURIComponent("Canvas authorization was denied")}`);
    return;
  }

  if (!code || !state || !storedState || state !== storedState || !canvasUrl) {
    res.redirect(`${appUrl}/signin?error=${encodeURIComponent("Invalid OAuth state — try again")}`);
    return;
  }

  const clientId = process.env["CANVAS_CLIENT_ID"];
  const clientSecret = process.env["CANVAS_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    res.redirect(`${appUrl}/signin?error=${encodeURIComponent("OAuth not configured — use PAT authentication instead")}`);
    return;
  }

  if (!VALIDATE_CANVAS_URL.test(canvasUrl)) {
    res.redirect(`${appUrl}/signin?error=${encodeURIComponent("Invalid Canvas URL in OAuth session")}`);
    return;
  }

  try {
    const tokenRes = await fetch(`${canvasUrl}/login/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/canvas`,
        code,
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(`${appUrl}/signin?error=${encodeURIComponent("Token exchange failed")}`);
      return;
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user: { id: number; name: string; primary_email?: string };
    };

    const canvasUser = tokenData.user;
    const email = canvasUser.primary_email || `canvas_${canvasUser.id}@carvis.local`;
    const userId = `canvas_${canvasUser.id}`;
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const userData = {
      email,
      name: canvasUser.name || null,
      canvasBaseUrl: canvasUrl,
      canvasAccessTokenEncrypted: encrypt(tokenData.access_token),
      canvasRefreshTokenEncrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      canvasTokenExpiresAt: expiresAt,
      canvasUserId: String(canvasUser.id),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(usersTable).set(userData).where(eq(usersTable.id, userId));
    } else {
      await db.insert(usersTable).values({ id: userId, ...userData });
    }

    const sessionId = randomBytes(32).toString("hex");
    const sessionExpiry = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(sessionsTable).values({ id: sessionId, userId, expiresAt: sessionExpiry });

    createSessionCookie(res, sessionId);
    res.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    req.log.error({ err }, "Canvas OAuth callback error");
    res.redirect(`${appUrl}/signin?error=${encodeURIComponent("Authentication failed — please try again")}`);
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    canvasBaseUrl: user.canvasBaseUrl,
    canvasConnected: !!user.canvasAccessTokenEncrypted,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const reqWithCookies = req as import("express").Request & { cookies: Record<string, string> };
  const sessionId = reqWithCookies.cookies?.["carvis_session"];
  if (sessionId) {
    try {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
    } catch {
    }
  }
  res.clearCookie("carvis_session", { path: "/" });
  res.json({ success: true });
});

export default router;
