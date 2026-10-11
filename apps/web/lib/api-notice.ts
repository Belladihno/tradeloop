import { ApiError } from "./api-server";

const NOTICE = "Too many attempts right now — please try again shortly.";

export function rateLimitNotice(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 429) return NOTICE;
  return null;
}
