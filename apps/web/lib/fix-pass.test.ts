import { describe, expect, it } from "vitest";
import { ApiError } from "./api-server";
import { rateLimitNotice } from "./api-notice";
import { isDisplayableImage } from "./images";
import { asCategoryList, asProductPage } from "./api-shapes";

describe("rateLimitNotice", () => {
  it("returns the notice copy for 429 errors", () => {
    expect(rateLimitNotice(new ApiError(429, "TOO_MANY_REQUESTS", "Too Many Requests"))).toBe(
      "Too many attempts right now — please try again shortly.",
    );
  });

  it("returns null for anything else", () => {
    expect(rateLimitNotice(new ApiError(400, "BAD_REQUEST", "nope"))).toBeNull();
    expect(rateLimitNotice(new Error("boom"))).toBeNull();
    expect(rateLimitNotice(null)).toBeNull();
  });
});

describe("isDisplayableImage", () => {
  it("accepts https URLs", () => {
    expect(isDisplayableImage("https://cdn.example.com/p.jpg")).toBe(true);
  });

  it("rejects null, empty, and non-https URLs", () => {
    expect(isDisplayableImage(null)).toBe(false);
    expect(isDisplayableImage("")).toBe(false);
    expect(isDisplayableImage("http://cdn.example.com/p.jpg")).toBe(false);
    expect(isDisplayableImage("javascript:alert(1)")).toBe(false);
  });
});

describe("api shapes", () => {
  it("passes category arrays through and rejects anything else", () => {
    const rows = [{ id: "1", name: "Phones", slug: "phones", children: [] }];
    expect(asCategoryList(rows)).toEqual(rows);
    expect(asCategoryList({ items: rows })).toEqual([]);
    expect(asCategoryList(null)).toEqual([]);
  });

  it("passes product pages through and rejects anything else", () => {
    const page = { items: [{ id: "1" }], nextCursor: null };
    expect(asProductPage(page)).toEqual(page);
    expect(asProductPage([])).toEqual({ items: [], nextCursor: null });
    expect(asProductPage(null)).toEqual({ items: [], nextCursor: null });
  });
});
