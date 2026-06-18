import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { Request, Response } from "express";

beforeAll(() => {
  process.env["ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["DATABASE_URL"] = "postgresql://fake:fake@localhost/fake";
  process.env["SUPABASE_URL"] = "http://localhost:54321";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-key";
});

const mockGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

const mockSelect = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelect,
  },
  usersTable: {},
  sessionsTable: {},
  coursesTable: {},
  assignmentsTable: {},
}));

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

async function getUserMeHandler() {
  const { default: router } = await import("../routes/user.js");
  const stack = (router as any).stack as { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Function }[] } }[];
  const route = stack.find((l) => l.route?.path === "/user/me" && l.route.methods["get"]);
  return route?.route?.stack[0]?.handle as Function | undefined;
}

describe("GET /user/me route handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth token provided", async () => {
    const handler = await getUserMeHandler();
    if (!handler) throw new Error("GET /user/me handler not found on route stack");

    const captured: { status?: number; body?: unknown } = {};
    const res = {
      status: vi.fn((code: number) => { captured.status = code; return { json: (b: unknown) => { captured.body = b; } }; }),
      json: vi.fn((b: unknown) => { captured.body = b; if (captured.status === undefined) captured.status = 200; }),
    } as unknown as Response;
    const req = { headers: {} } as unknown as Request;

    await handler(req, res);
    expect(captured.status).toBe(401);
  });

  it("returns canvasConnected: true when user has an encrypted token", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-1", email: "u@school.edu" } },
      error: null,
    });

    const limitMock = vi.fn().mockResolvedValue([{
      id: "u-1",
      email: "u@school.edu",
      name: "User",
      canvasBaseUrl: "https://school.instructure.com",
      canvasAccessTokenEncrypted: "iv:cipher:tag",
      canvasRefreshTokenEncrypted: null,
      canvasTokenExpiresAt: null,
      canvasUserId: "42",
    }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockSelect.mockReturnValue({ from: fromMock } as any);

    const handler = await getUserMeHandler();
    if (!handler) throw new Error("GET /user/me handler not found on route stack");

    const captured: { status?: number; body?: unknown } = {};
    const res = {
      status: vi.fn((code: number) => { captured.status = code; return { json: (b: unknown) => { captured.body = b; } }; }),
      json: vi.fn((b: unknown) => { captured.body = b; if (captured.status === undefined) captured.status = 200; }),
    } as unknown as Response;
    const req = { headers: { authorization: "Bearer good-token" }, log: { error: vi.fn() } } as unknown as Request;

    await handler(req, res);
    expect(captured.status).toBe(200);
    expect((captured.body as any)?.canvasConnected).toBe(true);
  });

  it("returns canvasConnected: false when user has no encrypted token", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-2", email: "u2@school.edu" } },
      error: null,
    });

    const limitMock = vi.fn().mockResolvedValue([{
      id: "u-2",
      email: "u2@school.edu",
      name: "User2",
      canvasBaseUrl: null,
      canvasAccessTokenEncrypted: null,
      canvasRefreshTokenEncrypted: null,
      canvasTokenExpiresAt: null,
      canvasUserId: null,
    }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockSelect.mockReturnValue({ from: fromMock } as any);

    const handler = await getUserMeHandler();
    if (!handler) throw new Error("GET /user/me handler not found on route stack");

    const captured: { status?: number; body?: unknown } = {};
    const res = {
      status: vi.fn((code: number) => { captured.status = code; return { json: (b: unknown) => { captured.body = b; } }; }),
      json: vi.fn((b: unknown) => { captured.body = b; if (captured.status === undefined) captured.status = 200; }),
    } as unknown as Response;
    const req = { headers: { authorization: "Bearer good-token" }, log: { error: vi.fn() } } as unknown as Request;

    await handler(req, res);
    expect(captured.status).toBe(200);
    expect((captured.body as any)?.canvasConnected).toBe(false);
  });
});
