import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

beforeAll(() => {
  process.env["ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["DATABASE_URL"] = "postgresql://fake:fake@localhost/fake";
  process.env["CANVAS_CLIENT_ID"] = "fake-client-id";
  process.env["CANVAS_CLIENT_SECRET"] = "fake-client-secret";
  process.env["APP_URL"] = "https://carvis.example.com";
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  usersTable: {},
  sessionsTable: {},
}));

async function getOAuthCallbackHandler() {
  const { default: router } = await import("../routes/auth.js");
  const stack = (router as any).stack as {
    route?: { path: string; methods: Record<string, boolean>; stack: { handle: Function }[] };
  }[];
  const route = stack.find((l) => l.route?.path === "/auth/canvas" && l.route.methods["get"]);
  const handler = route?.route?.stack[0]?.handle;
  if (!handler) throw new Error("GET /auth/canvas handler not found on route stack");
  return handler;
}

function makeRedirectCapture() {
  const redirected: string[] = [];
  return {
    res: {
      redirect: vi.fn((url: string) => { redirected.push(url); }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
    },
    redirected,
  };
}

describe("OAuth callback SSRF guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).fetch;
  });

  it("rejects non-instructure canvas_oauth_url cookie before token exchange fetch", async () => {
    const handler = await getOAuthCallbackHandler();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const state = "deadbeef1234";
    const req = {
      query: { code: "authcode123", state },
      cookies: {
        canvas_oauth_state: state,
        canvas_oauth_url: "http://internal-host.local",
      },
      log: { error: vi.fn() },
    } as any;
    const { res, redirected } = makeRedirectCapture();

    await handler(req, res);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(redirected).toHaveLength(1);
    expect(redirected[0]).toContain("/signin?error=");
    expect(redirected[0]).not.toContain("/dashboard");
  });

  it("rejects http:// instructure.com URL in cookie (must be https)", async () => {
    const handler = await getOAuthCallbackHandler();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const state = "deadbeef1234";
    const req = {
      query: { code: "authcode123", state },
      cookies: {
        canvas_oauth_state: state,
        canvas_oauth_url: "http://school.instructure.com",
      },
      log: { error: vi.fn() },
    } as any;
    const { res, redirected } = makeRedirectCapture();

    await handler(req, res);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(redirected[0]).toContain("/signin?error=");
  });

  it("rejects URL with path traversal appended to instructure.com", async () => {
    const handler = await getOAuthCallbackHandler();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const state = "deadbeef1234";
    const req = {
      query: { code: "authcode123", state },
      cookies: {
        canvas_oauth_state: state,
        canvas_oauth_url: "https://school.instructure.com.evil.com",
      },
      log: { error: vi.fn() },
    } as any;
    const { res, redirected } = makeRedirectCapture();

    await handler(req, res);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(redirected[0]).toContain("/signin?error=");
  });

  it("allows a valid instructure.com URL through to the token exchange", async () => {
    const handler = await getOAuthCallbackHandler();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const state = "deadbeef1234";
    const req = {
      query: { code: "authcode123", state },
      cookies: {
        canvas_oauth_state: state,
        canvas_oauth_url: "https://myschool.instructure.com",
      },
      log: { error: vi.fn() },
    } as any;
    const { res } = makeRedirectCapture();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledOnce();
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://myschool.instructure.com");
    expect(calledUrl).toContain("/login/oauth2/token");
  });
});
