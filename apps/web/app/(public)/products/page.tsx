import Link from "next/link";
import { apiServer } from "@/lib/api-server";
import { asCategoryList, asProductPage } from "@/lib/api-shapes";
import { findCategoryName } from "@/lib/category-tree";
import { rateLimitNotice } from "@/lib/api-notice";
import type { CatalogParams } from "@/lib/catalog-params";
import { paramHref } from "@/lib/catalog-params";
import { buildProductQuery } from "@/lib/catalog-query";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { SortSelect } from "@/components/catalog/SortSelect";
import { ViewToggle } from "@/components/catalog/ViewToggle";
import { ProductListItem } from "@/components/catalog/ProductListItem";
import { ProductCard } from "@/components/domain/ProductCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toParams(searchParams: Record<string, string | string[] | undefined>): CatalogParams {
  return {
    q: first(searchParams.q),
    category: first(searchParams.category),
    minPrice: first(searchParams.minPrice),
    maxPrice: first(searchParams.maxPrice),
    inStock: first(searchParams.inStock),
    sort: first(searchParams.sort),
    view: first(searchParams.view),
    cursor: first(searchParams.cursor),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = toParams(searchParams);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const api = apiServer(baseUrl);

  const departments = asCategoryList(await api.get("/categories").catch(() => []));
  const activeCategoryName = params.category
    ? findCategoryName(departments, params.category)
    : undefined;

  let items = asProductPage({}).items;
  let nextCursor: string | null = null;
  let notice: string | undefined;
  try {
    const page = asProductPage(await api.get(buildProductQuery(params)));
    items = page.items;
    nextCursor = page.nextCursor;
  } catch (error) {
    notice = rateLimitNotice(error) ?? "Could not load products right now.";
  }

  const isList = params.view === "list";
  const summary = params.category
    ? activeCategoryName ?? params.category
    : params.q
      ? `Results for “${params.q}”`
      : "All Departments";

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 md:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-ink-muted">
        <Link href="/" className="hover:text-teal">
          Home
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/products" className="hover:text-teal">
          Products
        </Link>
        {params.category && (
          <>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-ink-secondary">{summary}</span>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold md:text-[30px]">
            <span className="material-symbols-outlined text-[24px] text-teal">verified_user</span>
            Authenticated Marketplace Catalog
          </h1>
          <p className="mt-1 text-xs">
            <span className="rounded-full border border-teal bg-teal-light px-2 py-0.5 font-medium text-teal-dark">
              NDPR &amp; CAC Audited
            </span>
            <span className="ml-2 text-ink-secondary">
              Showing {items.length} escrow-guaranteed item{items.length === 1 ? "" : "s"} · Zero
              vendor default risk
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SortSelect params={params} />
          <ViewToggle params={params} />
        </div>
      </div>

      <div className="mt-3">
        <ActiveFilters params={params} categoryName={activeCategoryName} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
        <FilterSidebar params={params} departments={departments} />

        <section
          aria-label="Product results"
          data-view={isList ? "list" : "grid"}
          className="min-w-0"
        >
          {items.length === 0 ? (
            <div role="status" className="rounded-xl border border-line bg-surface-container-lowest px-4 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-ink-muted">search_off</span>
              <p className="mt-2 text-sm font-semibold">{notice ?? "No products match these filters"}</p>
              {!notice && (
                <p className="mt-1 text-[13px] text-ink-secondary">
                  Try widening the price range or clearing a filter.
                </p>
              )}
              <Link
                href="/products"
                className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold transition-colors hover:border-teal hover:text-teal"
              >
                Clear all filters
              </Link>
            </div>
          ) : isList ? (
            <div className="flex flex-col gap-3">
              {items.map((product) => (
                <ProductListItem key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {nextCursor && (
            <div className="mt-6 text-center">
              <Link
                href={paramHref(params, { cursor: nextCursor })}
                className="inline-block rounded-lg border border-line px-5 py-2.5 text-sm font-semibold transition-colors hover:border-teal hover:text-teal"
              >
                Load more
              </Link>
            </div>
          )}
        </section>
      </div>

      <section aria-label="Trust" className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: "shield_lock", title: "100% Escrow Protection", body: "Funds stay isolated in secure vault accounts until delivery confirmation." },
          { icon: "verified", title: "Verified Merchants", body: "Strict KYC, CAC verification, and merchant history benchmarks." },
          { icon: "bolt", title: "Seller Payouts on Delivery", body: "Funds settle to the seller once you confirm receipt." },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-xl border border-line bg-surface-container-lowest p-4">
            <span className="material-symbols-outlined text-[22px] text-teal">{item.icon}</span>
            <div>
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-secondary">{item.body}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
