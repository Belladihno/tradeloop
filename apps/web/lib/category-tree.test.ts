import { describe, expect, it } from "vitest";
import type { CategoryNode } from "./api-shapes";
import { findCategoryName } from "./category-tree";

const tree: CategoryNode[] = [
  {
    id: "1",
    name: "Phones & Computing",
    slug: "phones-computing",
    children: [
      { id: "2", name: "Mobile Phones", slug: "mobile-phones", children: [] },
      { id: "3", name: "Laptops", slug: "laptops", children: [] },
    ],
  },
  { id: "4", name: "Audio", slug: "audio", children: [] },
];

describe("findCategoryName", () => {
  it("finds a root category", () => {
    expect(findCategoryName(tree, "audio")).toBe("Audio");
  });

  it("finds a nested child", () => {
    expect(findCategoryName(tree, "laptops")).toBe("Laptops");
  });

  it("returns undefined for a miss", () => {
    expect(findCategoryName(tree, "nope")).toBeUndefined();
  });

  it("returns undefined for an empty tree", () => {
    expect(findCategoryName([], "audio")).toBeUndefined();
  });
});
