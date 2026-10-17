import Link from "next/link";
import type { CatalogParams } from "@/lib/catalog-params";
import { paramHref } from "@/lib/catalog-params";

function Chip({ label, removeHref }: { label: string; removeHref: string }) {
  return (
    <Link
      href={removeHref}
      className="inline-flex items-center gap-1 rounded-lg border border-line/60 bg-surface px-2 py-1 text-xs transition-colors hover:border-teal hover:text-teal"
    >
      {label}
      <span className="material-symbols-outlined text-[14px]">close</span>
    </Link>
  );
}

function priceLabel(min?: string, max?: string): string | null {
  const fmt = (value: string) => `₦${Number(value).toLocaleString("en-NG")}`;
  const lo = min && Number.isFinite(Number(min)) ? fmt(min) : undefined;
  const hi = max && Number.isFinite(Number(max)) ? fmt(max) : undefined;
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `From ${lo}`;
  if (hi) return `Under ${hi}`;
  return null;
}

export function ActiveFilters({
  params,
  categoryName,
}: {
  params: CatalogParams;
  categoryName?: string;
}) {
  const chips: { key: string; label: string; clear: Partial<CatalogParams> }[] = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”`, clear: { q: "" } });
  if (params.category) {
    chips.push({ key: "category", label: categoryName ?? params.category, clear: { category: "" } });
  }
  if (params.minPrice || params.maxPrice) {
    const label = priceLabel(params.minPrice, params.maxPrice);
    if (label) {
      chips.push({ key: "price", label, clear: { minPrice: "", maxPrice: "" } });
    }
  }
  if (params.inStock === "true") {
    chips.push({ key: "inStock", label: "In stock only", clear: { inStock: "" } });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-ink-secondary">Active filters:</span>
      {chips.map((chip) => (
        <Chip key={chip.key} label={chip.label} removeHref={paramHref(params, { ...chip.clear, cursor: "" })} />
      ))}
      <Link href="/products" className="text-xs font-semibold text-teal hover:underline">
        Clear all
      </Link>
    </div>
  );
}
