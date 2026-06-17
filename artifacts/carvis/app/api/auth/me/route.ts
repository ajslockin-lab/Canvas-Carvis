import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    canvasBaseUrl: user.canvasBaseUrl,
    canvasConnected: !!user.canvasAccessTokenEncrypted,
  });
}
