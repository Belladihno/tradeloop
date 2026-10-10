import { ApiError } from "./api-server";

export interface BrowserAuth {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setSession(accessToken: string, refreshToken: string): void;
  clearSession(): void;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function apiClient(
  baseUrl: string,
  auth: BrowserAuth,
): { get<T>(path: string): Promise<T> } {
  async function rawGet<T>(path: string, token: string | null): Promise<T> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1${path}`, { headers });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the API");
    }
    let body: { success: boolean; data?: T; error?: string; message?: string };
    try {
      body = (await res.json()) as { success: boolean; data?: T; error?: string; message?: string };
    } catch {
      throw new ApiError(res.status, "BAD_RESPONSE", "API returned an unreadable response");
    }
    if (!res.ok || body.success === false) {
      throw new ApiError(res.status, body.error ?? "REQUEST_FAILED", body.message ?? res.statusText);
    }
    return body.data as T;
  }

  async function refresh(): Promise<TokenPair | null> {
    const refreshToken = auth.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const body = (await res.json()) as {
        success: boolean;
        data?: TokenPair;
      };
      if (!res.ok || body.success === false || !body.data) return null;
      return body.data;
    } catch {
      return null;
    }
  }

  async function get<T>(path: string): Promise<T> {
    try {
      return await rawGet<T>(path, auth.getAccessToken());
    } catch (error) {
      // One refresh and one retry only. Anything else (including a second
      // 401, which signals token theft handling server-side) drops the
      // session instead of looping.
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const pair = await refresh();
      if (!pair) {
        auth.clearSession();
        throw error;
      }
      auth.setSession(pair.accessToken, pair.refreshToken);
      try {
        return await rawGet<T>(path, pair.accessToken);
      } catch (retryError) {
        auth.clearSession();
        throw retryError;
      }
    }
  }

  return { get };
}
