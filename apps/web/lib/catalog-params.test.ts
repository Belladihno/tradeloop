import { describe, expect, it } from "vitest";
import { paramHref } from "./catalog-params";

describe("paramHref", () => {
  it("preserves active filters while overriding one", () => {
    expect(paramHref({ q: "phone", sort: "newest" }, { sort: "price_asc" })).toBe(
      "/products?q=phone&sort=price_asc",
    );
  });

  it("drops keys set to empty (filter removal)", () => {
    expect(paramHref({ q: "phone", minPrice: "100" }, { minPrice: "" })).toBe(
      "/products?q=phone",
    );
  });

  it("returns the bare path when nothing is active", () => {
    expect(paramHref({}, {})).toBe("/products");
  });

  it("encodes special characters", () => {
    expect(paramHref({ q: "a&b" }, {})).toBe("/products?q=a%26b");
  });
});
