import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiServer } from "./api-server";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiServer", () => {
  it("unwraps the data envelope on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { success: true, message: "ok", data: { balance: "10.00" } }),
      ),
    );
    const api = apiServer("http://localhost:3000");
    await expect(api.get<{ balance: string }>("/wallet/balance")).resolves.toEqual({
      balance: "10.00",
    });
  });

  it("throws ApiError with code and message from the error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, {
          success: false,
          error: "INSUFFICIENT_FUNDS",
          message: "Wallet balance is insufficient for this order",
          timestamp: "2026-01-01T00:00:00.000Z",
          path: "/api/v1/orders",
        }),
      ),
    );
    const api = apiServer("http://localhost:3000");
    const failure = await api
      .get("/orders")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(ApiError);
    const apiError = failure as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("INSUFFICIENT_FUNDS");
    expect(apiError.message).toBe("Wallet balance is insufficient for this order");
  });

  it("makes exactly one request on 429 (no retry loop)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, {
        success: false,
        error: "TOO_MANY_REQUESTS",
        message: "Too Many Requests",
        timestamp: "2026-01-01T00:00:00.000Z",
        path: "/api/v1/auth/login",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = apiServer("http://localhost:3000");
    await expect(api.get("/auth/login")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws ApiError (not a hang) when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const api = apiServer("http://localhost:3000");
    await expect(api.get("/health")).rejects.toBeInstanceOf(ApiError);
  });
});
