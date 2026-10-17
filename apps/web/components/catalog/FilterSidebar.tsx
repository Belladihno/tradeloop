import Link from "next/link";
import type { CategoryNode } from "@/lib/api-shapes";
import type { CatalogParams } from "@/lib/catalog-params";
import { paramHref } from "@/lib/catalog-params";
import { CategoryIcon } from "./CategoryIcon";

const PRICE_BUCKETS = [
  { label: "Under ₦200k", minPrice: "", maxPrice: "200000" },
  { label: "₦200k – ₦1M", minPrice: "200000", maxPrice: "1000000" },
  { label: "₦1M – ₦3M", minPrice: "1000000", maxPrice: "3000000" },
] as const;

export function FilterSidebar({
  params,
  departments,
}: {
  params: CatalogParams;
  departments: CategoryNode[];
}) {
  return (
    <aside aria-label="Filters" className="space-y-6">
      <details className="rounded-xl border border-line bg-surface-container-lowest md:hidden" open={false}>
        <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">tune</span>
            Filters
          </span>
        </summary>
        <div className="border-t border-line/60 p-4">
          <FilterForm params={params} />
        </div>
      </details>
      <div className="hidden md:block md:space-y-6">
        <section aria-label="Departments" className="rounded-xl border border-line bg-surface-container-lowest p-4">
          <h2 className="mb-3 text-sm font-semibold">Departments</h2>
          <ul className="space-y-1">
            {departments.map((dept) => (
              <li key={dept.id}>
                <DepartmentLink params={params} node={dept} root />
                {dept.children.length > 0 && (
                  <ul className="ml-4 space-y-0.5 border-l border-line/60 pl-2">
                    {dept.children.map((child) => (
                      <li key={child.id}>
                        <DepartmentLink params={params} node={child} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {departments.length === 0 && (
              <li className="px-2 py-1 text-[13px] text-ink-muted">No departments yet</li>
            )}
          </ul>
        </section>
        <div className="rounded-xl border border-line bg-surface-container-lowest p-4">
          <FilterForm params={params} />
        </div>
      </div>
    </aside>
  );
}

function DepartmentLink({
  params,
  node,
  root = false,
}: {
  params: CatalogParams;
  node: CategoryNode;
  root?: boolean;
}) {
  const active = params.category === node.slug;
  return (
    <Link
      href={paramHref(params, { category: node.slug, cursor: "" })}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface ${
        active ? "font-semibold text-teal" : root ? "font-medium" : "text-ink-secondary"
      }`}
    >
      {root && <CategoryIcon slug={node.slug} />}
      {node.name}
    </Link>
  );
}

function FilterForm({ params }: { params: CatalogParams }) {
  return (
    <form method="get" action="/products" className="space-y-5">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.category && <input type="hidden" name="category" value={params.category} />}
      {params.view && <input type="hidden" name="view" value={params.view} />}
      {params.sort && params.sort !== "newest" && (
        <input type="hidden" name="sort" value={params.sort} />
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Price Range (NGN)</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-min" className="sr-only">Min price</label>
          <input
            id="filter-min"
            name="minPrice"
            inputMode="decimal"
            defaultValue={params.minPrice ?? ""}
            placeholder="Min"
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
          />
          <span aria-hidden="true" className="text-ink-muted">–</span>
          <label htmlFor="filter-max" className="sr-only">Max price</label>
          <input
            id="filter-max"
            name="maxPrice"
            inputMode="decimal"
            defaultValue={params.maxPrice ?? ""}
            placeholder="Max"
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRICE_BUCKETS.map((bucket) => (
            <Link
              key={bucket.label}
              href={paramHref(params, { minPrice: bucket.minPrice, maxPrice: bucket.maxPrice, cursor: "" })}
              className="rounded-lg border border-line/60 px-2 py-1 text-xs transition-colors hover:border-teal hover:text-teal"
            >
              {bucket.label}
            </Link>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="inStock"
          value="true"
          defaultChecked={params.inStock === "true"}
          className="h-4 w-4 accent-teal"
        />
        In stock only
      </label>
      <div>
        <span className="mb-2 block text-sm font-semibold">Condition</span>
        <p className="text-[13px] leading-5 text-ink-secondary">
          Every listing is a brand-new, factory-sealed item from a verified merchant.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
        >
          Apply Filters
        </button>
        <Link
          href="/products"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold transition-colors hover:border-teal hover:text-teal"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
