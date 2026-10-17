import type { CatalogParams } from "./catalog-params";

// Mirrors the backend price rule (`^\d+(\.\d{1,2})?$`). A malformed price is
// dropped rather than forwarded — the API answers 400 to junk, which would
// blank the whole catalog over a typo.
const PRICE = /^\d+(\.\d{1,2})?$/;

// Maps catalog URL params onto the /products query. `view` is presentation-only
// and never sent to the API. `sort` defaults server-side, so it is dropped when
// absent to keep cache keys stable.
export function buildProductQuery(params: CatalogParams, limit = 24): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.minPrice && PRICE.test(params.minPrice)) search.set("minPrice", params.minPrice);
  if (params.maxPrice && PRICE.test(params.maxPrice)) search.set("maxPrice", params.maxPrice);
  if (params.inStock === "true") search.set("inStock", "true");
  if (params.sort) search.set("sort", params.sort);
  if (params.cursor) search.set("cursor", params.cursor);
  search.set("limit", String(limit));
  return `/products?${search.toString()}`;
}
