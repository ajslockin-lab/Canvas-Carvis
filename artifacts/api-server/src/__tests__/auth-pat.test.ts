import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

beforeAll(() => {
  process.env["ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["DATABASE_URL"] = "postgresql://fake:fake@localhost/fake";
});

const insertValuesMock = vi.fn().mockResolvedValue([]);
const selectLimitMock = vi.fn().mockResolvedValue([]);

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: selectLimitMock }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  usersTable: {},
  sessionsTable: {},
}));

function getPatHandler() {
  const { default: router } = require("../routes/auth.js");
  const stack = (router as any).stack as { route?: { path: string; stack: { handle: Function }[] } }[];
  const patRoute = stack.find((l) => l.route?.path === "/auth/canvas/pat");
  return patRoute?.route?.stack[0]?.handle as Function | undefined;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, cookie: vi.fn(), _json: json, _status: status };
}

describe("Canvas PAT auth route handler", () => {
  // TODO: add test that session cookie is set (name, httpOnly, sameSite) on successful PAT auth
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is missing required fields", async () => {
    const { default: router } = await import("../routes/auth.js");
    const stack = (router as any).stack as { route?: { path: string; stack: { handle: Function }[] } }[];
    const patRoute = stack.find((l) => l.route?.path === "/auth/canvas/pat");
    const handler = patRoute?.route?.stack[0]?.handle;
    if (!handler) throw new Error("Handler not found on route stack");

    const req = {
      body: { canvasUrl: "https://school.instructure.com" },
      log: { error: vi.fn() },
    } as any;

    const captured: { status?: number; body?: unknown } = {};
    const res = {
      status: vi.fn((code: number) => { captured.status = code; return { json: (b: unknown) => { captured.body = b; } }; }),
      json: vi.fn((b: unknown) => { captured.body = b; }),
      cookie: vi.fn(),
    } as any;

    await handler(req, res);
    expect(captured.status).toBe(400);
    expect(typeof (captured.body as any)?.error).toBe("string");
  });

  it("returns 400 for a non-instructure.com Canvas URL", async () => {
    const { default: router } = await import("../routes/auth.js");
    const stack = (router as any).stack as { route?: { path: string; stack: { handle: Function }[] } }[];
    const patRoute = stack.find((l) => l.route?.path === "/auth/canvas/pat");
    const handler = patRoute?.route?.stack[0]?.handle;
    if (!handler) throw new Error("Handler not found on route stack");

    const req = {
      body: { canvasUrl: "http://notcanvas.example.com", pat: "some-token" },
      log: { error: vi.fn() },
    } as any;
    const captured: { status?: number; body?: unknown } = {};
    const res = {
      status: vi.fn((code: number) => { captured.status = code; return { json: (b: unknown) => { captured.body = b; } }; }),
      json: vi.fn((b: unknown) => { captured.body = b; }),
      cookie: vi.fn(),
    } as any;

    await handler(req, res);
    expect(captured.status).toBe(400);
    expect((captured.body as any)?.error).toMatch(/valid Canvas URL/i);
  });

  it("stores an encrypted token — not the raw PAT — when auth succeeds", async () => {
    const fakeToken = "test-canvas-pat-xyz";
    const mockCanvasUser = { id: 999, name: "Jane Student", primary_email: "jane@school.edu" };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCanvasUser,
    });

    const { default: router } = await import("../routes/auth.js");
    const stack = (router as any).stack as { route?: { path: string; stack: { handle: Function }[] } }[];
    const patRoute = stack.find((l) => l.route?.path === "/auth/canvas/pat");
    const handler = patRoute?.route?.stack[0]?.handle;
    if (!handler) throw new Error("Handler not found on route stack");

    const req = {
      body: { canvasUrl: "https://myschool.instructure.com", pat: fakeToken },
      log: { error: vi.fn() },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
    } as any;

    await handler(req, res);

    const allInsertArgs: unknown[] = insertValuesMock.mock.calls.flat(2);
    const stringArgs = allInsertArgs.map((a) => JSON.stringify(a));

    const rawTokenStored = stringArgs.some((s) => s.includes(fakeToken));
    expect(rawTokenStored).toBe(false);

    const encryptedTokenStored = stringArgs.some((s) => {
      try {
        const obj = JSON.parse(s);
        const tokenField = obj?.canvasAccessTokenEncrypted as string | undefined;
        return typeof tokenField === "string" && tokenField.includes(":") && tokenField !== fakeToken;
      } catch {
        return false;
      }
    });
    expect(encryptedTokenStored).toBe(true);
  });
});
