import { describe, expect, it } from "vitest";
import { categoryIcon } from "./category-icons";

describe("categoryIcon", () => {
  it("maps known slugs to their Stitch icons", () => {
    expect(categoryIcon("phones-gadgets")).toBe("smartphone");
    expect(categoryIcon("laptops-tech")).toBe("laptop_mac");
    expect(categoryIcon("fashion-apparel")).toBe("checkroom");
    expect(categoryIcon("audio-gadgets")).toBe("headphones");
    expect(categoryIcon("solar-power")).toBe("solar_power");
    expect(categoryIcon("home-office")).toBe("desk");
  });

  it("matches case-insensitively and falls back to storefront", () => {
    expect(categoryIcon("Phones-GADGETS")).toBe("smartphone");
    expect(categoryIcon("something-new")).toBe("storefront");
    expect(categoryIcon("")).toBe("storefront");
  });
});
