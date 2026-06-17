import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("carvis_session")?.value;
  if (sessionId) {
    try {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
    } catch {
      // best-effort delete
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete("carvis_session");
  return response;
}
