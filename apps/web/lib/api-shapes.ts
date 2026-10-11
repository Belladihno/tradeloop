export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

export interface DealProduct {
  id: string;
  slug: string;
  name: string;
  price: string;
  stock: number;
  imageUrl: string | null;
  category: { id: string; name: string; slug: string } | null;
}

export interface ProductPage {
  items: DealProduct[];
  nextCursor: string | null;
}

// A 200 with an unexpected shape must degrade to empty, never throw into prerender.
export function asCategoryList(value: unknown): CategoryNode[] {
  return Array.isArray(value) ? (value as CategoryNode[]) : [];
}

export function asProductPage(value: unknown): ProductPage {
  if (typeof value === "object" && value !== null && Array.isArray((value as ProductPage).items)) {
    return value as ProductPage;
  }
  return { items: [], nextCursor: null };
}
