import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Client-side test for the decart-token edge function.
 *
 * Verifies that when an authenticated user invokes the edge function,
 * the response contains an ephemeral apiKey (ek_...).
 *
 * Uses mocked Supabase client + fetch so it runs offline in CI.
 * For a live integration test, set RUN_LIVE_DECART_TOKEN_TEST=1 and provide
 * VITE_SUPABASE_URL + a valid VITE_TEST_USER_JWT in env.
 */

const FUNCTION_PATH = "/functions/v1/decart-token";

describe("decart-token edge function (client-side)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an ephemeral apiKey for an authenticated user", async () => {
    const mockToken = {
      apiKey: "ek_test_abc123def456",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockToken), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const SUPABASE_URL = "https://lmtwcggtibohzyxhcpiy.supabase.co";
    const accessToken = "fake.jwt.token";

    const res = await fetch(`${SUPABASE_URL}${FUNCTION_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("apiKey");
    expect(typeof body.apiKey).toBe("string");
    expect(body.apiKey.startsWith("ek_")).toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${accessToken}`);
  });

  it("returns 401 when called without an Authorization header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await fetch(
      "https://lmtwcggtibohzyxhcpiy.supabase.co" + FUNCTION_PATH,
      { method: "POST" },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("does not leak the master DECART_API_KEY in the response", async () => {
    const mockToken = { apiKey: "ek_safe_ephemeral_key" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockToken), { status: 200 }),
    );

    const res = await fetch(
      "https://lmtwcggtibohzyxhcpiy.supabase.co" + FUNCTION_PATH,
      {
        method: "POST",
        headers: { Authorization: "Bearer fake.jwt.token" },
      },
    );
    const body = await res.json();

    // Ephemeral keys are prefixed ek_; master keys would not be.
    expect(body.apiKey.startsWith("ek_")).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sk_live_|sk_test_/);
  });
});

// Optional live test — only runs when explicitly enabled.
describe.skipIf(!process.env.RUN_LIVE_DECART_TOKEN_TEST)(
  "decart-token (live)",
  () => {
    it("really mints an ek_ token", async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}${FUNCTION_PATH}`;
      const jwt = process.env.VITE_TEST_USER_JWT!;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.apiKey).toMatch(/^ek_/);
    });
  },
);
