import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates names", () => {
    expect(slugify("Men's Running Shoes")).toBe("men-s-running-shoes");
    expect(slugify("  Ankara  Fabrics  ")).toBe("ankara-fabrics");
  });

  it("strips leading and trailing separators", () => {
    expect(slugify("--Sale!!")).toBe("sale");
  });
});

describe("uniqueSlug", () => {
  it("suffixes the entity id for uniqueness with stable URLs", () => {
    expect(uniqueSlug("Ankara Fabrics", "01a0ffa2-e0d0-7736-be4b-2fe8db53aec0")).toBe(
      "ankara-fabrics-01a0ffa2",
    );
  });
});
