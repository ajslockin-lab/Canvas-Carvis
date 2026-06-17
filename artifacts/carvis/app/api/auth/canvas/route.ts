import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt } from "@/server/crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const storedState = request.cookies.get("canvas_oauth_state")?.value;
  const canvasUrl = request.cookies.get("canvas_oauth_url")?.value;
  const appUrl = process.env["APP_URL"] || "";

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl}/signin?error=${encodeURIComponent("Canvas authorization was denied")}`
    );
  }

  if (!code || !state || !storedState || state !== storedState || !canvasUrl) {
    return NextResponse.redirect(
      `${appUrl}/signin?error=${encodeURIComponent("Invalid OAuth state — try again")}`
    );
  }

  const clientId = process.env["CANVAS_CLIENT_ID"];
  const clientSecret = process.env["CANVAS_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/signin?error=${encodeURIComponent("OAuth not configured — use PAT authentication instead")}`
    );
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
      return NextResponse.redirect(
        `${appUrl}/signin?error=${encodeURIComponent("Token exchange failed")}`
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user: {
        id: number;
        name: string;
        primary_email?: string;
      };
    };

    const canvasUser = tokenData.user;
    const email =
      canvasUser.primary_email || `canvas_${canvasUser.id}@carvis.local`;
    const userId = `canvas_${canvasUser.id}`;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

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
      canvasRefreshTokenEncrypted: tokenData.refresh_token
        ? encrypt(tokenData.refresh_token)
        : null,
      canvasTokenExpiresAt: expiresAt,
      canvasUserId: String(canvasUser.id),
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(usersTable)
        .set(userData)
        .where(eq(usersTable.id, userId));
    } else {
      await db.insert(usersTable).values({ id: userId, ...userData });
    }

    const sessionId = randomBytes(32).toString("hex");
    const sessionExpiry = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .insert(sessionsTable)
      .values({ id: sessionId, userId, expiresAt: sessionExpiry });

    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    response.cookies.set("carvis_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.delete("canvas_oauth_state");
    response.cookies.delete("canvas_oauth_url");
    return response;
  } catch {
    return NextResponse.redirect(
      `${appUrl}/signin?error=${encodeURIComponent("Authentication failed — please try again")}`
    );
  }
}
