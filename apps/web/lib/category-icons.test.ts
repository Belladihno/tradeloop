import { describe, expect, it } from "vitest";
import { categoryIcon } from "./category-icons";

describe("categoryIcon", () => {
  it("maps known slugs to their Stitch icons", () => {
    expect(categoryIcon("phones")).toBe("smartphone");
    expect(categoryIcon("computing")).toBe("laptop_mac");
    expect(categoryIcon("fashion")).toBe("checkroom");
    expect(categoryIcon("audio")).toBe("headphones");
    expect(categoryIcon("power")).toBe("solar_power");
    expect(categoryIcon("phones-tablets")).toBe("smartphone");
  });

  it("matches case-insensitively and falls back to storefront", () => {
    expect(categoryIcon("Phones")).toBe("smartphone");
    expect(categoryIcon("something-new")).toBe("storefront");
    expect(categoryIcon("")).toBe("storefront");
  });
});
