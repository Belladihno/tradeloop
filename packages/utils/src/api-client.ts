export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getAccessToken } = options;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const token = getAccessToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${path}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    request,
    products: {},
    wallet: {},
    orders: {},
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
