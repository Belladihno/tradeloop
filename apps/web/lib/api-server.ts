export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: string;
  message: string;
}

export function apiServer(baseUrl: string): { get<T>(path: string): Promise<T> } {
  async function get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1${path}`, {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the API");
    }
    let body: SuccessEnvelope<T> | ErrorEnvelope;
    try {
      body = (await res.json()) as SuccessEnvelope<T> | ErrorEnvelope;
    } catch {
      throw new ApiError(res.status, "BAD_RESPONSE", "API returned an unreadable response");
    }
    if (!res.ok || body.success === false) {
      const envelope = body as ErrorEnvelope;
      throw new ApiError(res.status, envelope.error ?? "REQUEST_FAILED", envelope.message ?? res.statusText);
    }
    return (body as SuccessEnvelope<T>).data;
  }

  return { get };
}
