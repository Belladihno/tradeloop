import { Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return sanitize(value);
  }
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return value.trim().replace(/\0/g, "");
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = sanitize(entry);
    return out;
  }
  return value;
}
