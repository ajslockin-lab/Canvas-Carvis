import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

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

export async function requireAuth(req: Request, res: Response): Promise<AuthedUser | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Auth service not configured" });
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }

  const supabaseUser = data.user;

  // Attach req.user for downstream use (minimal shape)
  (req as any).user = {
    id: supabaseUser.id,
    email: supabaseUser.email,
  };

  // Fetch the full user record from our DB
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, supabaseUser.id))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }

  return user;
}

export async function getCanvasToken(user: AuthedUser): Promise<string | null> {
  if (!user.canvasAccessTokenEncrypted) return null;
  try {
    return decrypt(user.canvasAccessTokenEncrypted);
  } catch {
    return null;
  }
}
