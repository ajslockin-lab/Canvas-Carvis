import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { AuthCanvasOauthStartBody } from "@workspace/api-zod";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = AuthCanvasOauthStartBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { canvasUrl } = parsed.data;
  const clientId = process.env["CANVAS_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json(
      { error: "OAuth not configured — use PAT authentication instead" },
      { status: 400 }
    );
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

  const response = NextResponse.json({
    url: `${canvasUrl}/login/oauth2/auth?${params.toString()}`,
  });
  response.cookies.set("canvas_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("canvas_oauth_url", canvasUrl, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
