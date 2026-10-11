import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-server";
import { apiClient, type BrowserAuth } from "./api-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function testAuth(): BrowserAuth & { saved: { access: string | null; refresh: string | null } } {
  const saved: { access: string | null; refresh: string | null } = { access: "old-access", refresh: "old-refresh" };
  return {
    saved,
    getAccessToken: () => saved.access,
    getRefreshToken: () => saved.refresh,
    setSession: (accessToken: string, refreshToken: string) => {
      saved.access = accessToken;
      saved.refresh = refreshToken;
    },
    clearSession: () => {
      saved.access = null;
      saved.refresh = null;
    },
  };
}

const unauthorized = () =>
  jsonResponse(401, {
    success: false,
    error: "UNAUTHORIZED",
    message: "Unauthorized",
    timestamp: "2026-01-01T00:00:00.000Z",
    path: "/api/v1/orders",
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient", () => {
  it("sends the stored access token and unwraps data", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer old-access");
      return jsonResponse(200, { success: true, message: "ok", data: { n: 1 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = apiClient("http://localhost:3000", testAuth());
    await expect(api.get<{ n: number }>("/orders")).resolves.toEqual({ n: 1 });
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(url);
        if (url.endsWith("/auth/refresh")) {
          return jsonResponse(200, {
            success: true,
            message: "ok",
            data: { accessToken: "new-access", refreshToken: "new-refresh" },
          });
        }
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === "Bearer new-access") {
          return jsonResponse(200, { success: true, message: "ok", data: { n: 2 } });
        }
        return unauthorized();
      }),
    );
    const auth = testAuth();
    const api = apiClient("http://localhost:3000", auth);
    await expect(api.get<{ n: number }>("/orders")).resolves.toEqual({ n: 2 });
    expect(auth.saved.access).toBe("new-access");
    expect(auth.saved.refresh).toBe("new-refresh");
    expect(calls.filter((url) => url.endsWith("/orders"))).toHaveLength(2);
  });

  it("clears the session and throws when the retry also returns 401", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, {
          success: true,
          message: "ok",
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        });
      }
      return unauthorized();
    });
    vi.stubGlobal("fetch", fetchMock);
    const auth = testAuth();
    const api = apiClient("http://localhost:3000", auth);
    await expect(api.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(auth.saved.access).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears the session when refresh itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/refresh")
          ? unauthorized()
          : unauthorized(),
      ),
    );
    const auth = testAuth();
    const api = apiClient("http://localhost:3000", auth);
    await expect(api.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(auth.saved.access).toBeNull();
    expect(auth.saved.refresh).toBeNull();
  });
});
