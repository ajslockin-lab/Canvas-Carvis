import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { decrypt } from "./crypto";

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  canvasBaseUrl: string | null;
  canvasAccessTokenEncrypted: string | null;
  canvasRefreshTokenEncrypted: string | null;
  canvasTokenExpiresAt: Date | null;
  canvasUserId: string | null;
}

export async function requireAuth(
  request: NextRequest
): Promise<[AuthedUser, null] | [null, NextResponse]> {
  const sessionId =
    request.cookies.get("carvis_session")?.value ||
    request.headers.get("x-session-token") ||
    null;

  if (!sessionId) {
    return [
      null,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    ];
  }

  const now = new Date();
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(eq(sessionsTable.id, sessionId), gt(sessionsTable.expiresAt, now))
    )
    .limit(1);

  if (!session) {
    return [
      null,
      NextResponse.json(
        { error: "Session expired or invalid" },
        { status: 401 }
      ),
    ];
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  if (!user) {
    return [
      null,
      NextResponse.json({ error: "User not found" }, { status: 401 }),
    ];
  }

  return [user, null];
}

export async function getCanvasToken(user: AuthedUser): Promise<string | null> {
  if (!user.canvasAccessTokenEncrypted) return null;
  try {
    return decrypt(user.canvasAccessTokenEncrypted);
  } catch {
    return null;
  }
}
