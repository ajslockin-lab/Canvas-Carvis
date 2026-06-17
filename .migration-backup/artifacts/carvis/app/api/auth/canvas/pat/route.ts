import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt } from "@/server/crypto";
import { fetchCanvasUser } from "@/server/canvas-fetch";
import { AuthCanvasPatBody } from "@workspace/api-zod";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = AuthCanvasPatBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { canvasUrl, pat } = parsed.data;
  const urlPattern = /^https:\/\/[a-zA-Z0-9-]+\.instructure\.com$/;
  if (!urlPattern.test(canvasUrl)) {
    return NextResponse.json(
      { error: "Must be a valid Canvas URL (https://school.instructure.com)" },
      { status: 400 }
    );
  }

  try {
    const canvasUser = await fetchCanvasUser(pat, canvasUrl);
    const email =
      canvasUser.primary_email ||
      canvasUser.login_id ||
      `canvas_${canvasUser.id}@carvis.local`;
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
      await db
        .update(usersTable)
        .set(userData)
        .where(eq(usersTable.id, userId));
    } else {
      await db.insert(usersTable).values({ id: userId, ...userData });
    }

    const sessionId = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(sessionsTable).values({ id: sessionId, userId, expiresAt });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name: canvasUser.name || null,
        canvasBaseUrl: canvasUrl,
      },
    });
    response.cookies.set("carvis_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not connect to Canvas — check your URL and access token",
      },
      { status: 400 }
    );
  }
}
