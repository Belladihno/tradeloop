import { describe, expect, it } from "vitest";
import { buildProductQuery } from "./catalog-query";

describe("buildProductQuery", () => {
  it("sends only provided filters and always a limit", () => {
    expect(buildProductQuery({ q: "phone" }, 24)).toBe("/products?q=phone&limit=24");
  });

  it("never forwards the presentation-only view param", () => {
    expect(buildProductQuery({ view: "list" })).toBe("/products?limit=24");
  });

  it("drops an unset sort to keep cache keys stable", () => {
    expect(buildProductQuery({})).toBe("/products?limit=24");
  });

  it("maps inStock true, omits it otherwise", () => {
    expect(buildProductQuery({ inStock: "true" })).toBe("/products?inStock=true&limit=24");
    expect(buildProductQuery({ inStock: "false" })).toBe("/products?limit=24");
  });

  it("appends the cursor from params for pagination", () => {
    expect(buildProductQuery({ sort: "price_asc", cursor: "abc" }, 24)).toBe(
      "/products?sort=price_asc&cursor=abc&limit=24",
    );
  });

  it("keeps well-formed prices and drops malformed ones", () => {
    expect(buildProductQuery({ minPrice: "200000", maxPrice: "10.50" })).toBe(
      "/products?minPrice=200000&maxPrice=10.50&limit=24",
    );
    expect(buildProductQuery({ minPrice: "abc", maxPrice: "1e9" })).toBe("/products?limit=24");
  });
});
