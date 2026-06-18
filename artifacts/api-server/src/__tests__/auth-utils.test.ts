import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Request, Response } from "express";

const mockGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

describe("lib/auth requireAuth", () => {
  it("rejects missing Authorization header", async () => {
    const { requireAuth } = await import("../lib/auth.js");
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const req = { headers: {} } as unknown as Request;
    const result = await requireAuth(req, mockRes);
    expect(result).toBeNull();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("rejects invalid JWT token", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const { requireAuth } = await import("../lib/auth.js");
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const req = {
      headers: { authorization: "Bearer bad-token" },
    } as unknown as Request;
    const result = await requireAuth(req, mockRes);
    expect(result).toBeNull();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockGetUser).toHaveBeenCalledWith("bad-token");
  });

  it("valid JWT but user not in local DB", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    const { requireAuth } = await import("../lib/auth.js");
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const req = {
      headers: { authorization: "Bearer valid-jwt-token" },
    } as unknown as Request;
    const result = await requireAuth(req, mockRes);
    // DB mock returns no user, so we get 401 "User not found"
    expect(result).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("valid-jwt-token");
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});

describe("lib/auth getCanvasToken", () => {
  it("returns null when no token", async () => {
    const { getCanvasToken } = await import("../lib/auth.js");
    const result = await getCanvasToken({
      id: "u1",
      email: "a@b.com",
      name: null,
      canvasBaseUrl: null,
      canvasAccessTokenEncrypted: null,
      canvasRefreshTokenEncrypted: null,
      canvasTokenExpiresAt: null,
      canvasUserId: null,
    });
    expect(result).toBeNull();
  });
});

describe("lib/auth getCanvasToken with valid encrypted token", () => {
  it("decrypts and returns canvas token", async () => {
    const { encrypt } = await import("../lib/crypto.js");
    const { getCanvasToken } = await import("../lib/auth.js");
    const encrypted = encrypt("my-access-token");
    const result = await getCanvasToken({
      id: "u1",
      email: "a@b.com",
      name: null,
      canvasBaseUrl: null,
      canvasAccessTokenEncrypted: encrypted,
      canvasRefreshTokenEncrypted: null,
      canvasTokenExpiresAt: null,
      canvasUserId: null,
    });
    expect(result).toBe("my-access-token");
  });
});

describe("lib/auth getCanvasToken with bad encrypted token", () => {
  it("returns null on corrupted token", async () => {
    const { getCanvasToken } = await import("../lib/auth.js");
    const result = await getCanvasToken({
      id: "u1",
      email: "a@b.com",
      name: null,
      canvasBaseUrl: null,
      canvasAccessTokenEncrypted: "corrupted:data",
      canvasRefreshTokenEncrypted: null,
      canvasTokenExpiresAt: null,
      canvasUserId: null,
    });
    expect(result).toBeNull();
  });
});
