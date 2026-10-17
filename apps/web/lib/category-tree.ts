import type { CategoryNode } from "./api-shapes";

export function findCategoryName(tree: CategoryNode[], slug: string): string | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node.name;
    const hit = findCategoryName(node.children, slug);
    if (hit !== undefined) return hit;
  }
  return undefined;
}
