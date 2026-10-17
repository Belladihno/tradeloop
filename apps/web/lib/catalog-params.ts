export interface CatalogParams {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  view?: string;
  cursor?: string;
}

// Builds catalog links that preserve active filters. Falsy values drop the
// key, so removing a filter is `paramHref(params, { key: "" })`.
export function paramHref(base: CatalogParams, overrides: Partial<CatalogParams>): string {
  const params = new URLSearchParams();
  const merged: CatalogParams = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}
