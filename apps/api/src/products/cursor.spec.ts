import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorException } from "./cursor";

describe("product cursor codec", () => {
  it("round-trips newest cursors", () => {
    const cursor = { sort: "newest" as const, id: "01a0ffa2-id" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("round-trips price and search cursors", () => {
    expect(
      decodeCursor(encodeCursor({ sort: "price_asc", price: "2500.00", id: "abc" })),
    ).toEqual({ sort: "price_asc", price: "2500.00", id: "abc" });
    expect(
      decodeCursor(encodeCursor({ sort: "search", rank: 0.075, id: "abc" })),
    ).toEqual({ sort: "search", rank: 0.075, id: "abc" });
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeCursor("!!!")).toThrow(InvalidCursorException);
    expect(() => decodeCursor(encodeCursor({ sort: "newest", id: "" }))).toThrow(
      InvalidCursorException,
    );
    expect(() =>
      decodeCursor(Buffer.from(JSON.stringify({ sort: "nope", id: "x" })).toString("base64url")),
    ).toThrow(InvalidCursorException);
  });
});
