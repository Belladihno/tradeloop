"use client";

import { useRouter } from "next/navigation";
import type { CatalogParams } from "@/lib/catalog-params";
import { paramHref } from "@/lib/catalog-params";

const SORTS = [
  { value: "newest", label: "Featured Escrow Deals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
] as const;

export function SortSelect({ params }: { params: CatalogParams }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-secondary sm:inline">Sort by:</span>
      <select
        value={params.sort ?? "newest"}
        onChange={(event) => router.push(paramHref(params, { sort: event.target.value, cursor: "" }))}
        aria-label="Sort products"
        className="cursor-pointer rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-medium focus:border-teal focus:outline-none"
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
