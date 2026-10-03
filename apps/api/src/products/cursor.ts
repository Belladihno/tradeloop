import { BadRequestException } from "@nestjs/common";
import type { ProductSort } from "@tradeloop/types";

export class InvalidCursorException extends BadRequestException {
  constructor() {
    super({ message: "Invalid pagination cursor", error: "INVALID_CURSOR" });
  }
}

export type CursorSort = ProductSort | "search";

export interface ProductCursor {
  sort: CursorSort;
  price?: string;
  rank?: number;
  id: string;
}

export function encodeCursor(cursor: ProductCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string): ProductCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorException();
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidCursorException();
  }
  const { sort, price, rank, id } = parsed as Record<string, unknown>;
  if (sort !== "newest" && sort !== "price_asc" && sort !== "price_desc" && sort !== "search") {
    throw new InvalidCursorException();
  }
  if (typeof id !== "string" || id.length === 0) {
    throw new InvalidCursorException();
  }
  return {
    sort,
    price: typeof price === "string" ? price : undefined,
    rank: typeof rank === "number" ? rank : undefined,
    id,
  };
}
