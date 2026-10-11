"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEPARTMENTS } from "@/lib/departments";

const POPULAR = ["iPhone 15 Pro", "M3 MacBook Air", "Sony ANC", "5kVA Inverter"] as const;

const MAX_QUERY_LENGTH = 200;

export function HeroSearch() {
  const router = useRouter();
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0].slug);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (department) params.set("category", department);
    router.push(`/products?${params.toString()}`);
  }

  return (
    <section className="w-full px-4 pt-4 md:border-b md:border-line/60 md:bg-gradient-to-b md:from-surface-container-lowest md:via-surface-container-low/50 md:to-surface md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl md:text-center">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-dark to-teal p-4 text-white shadow-sm md:hidden">
          <div className="relative flex flex-col gap-2">
            <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
              Nigeria&apos;s Regulated Marketplace Vault
            </p>
            <h1 className="font-display text-[34px] font-bold leading-[42px] tracking-tight">
              Find authenticated products. Pay only after inspection.
            </h1>
            <p className="max-w-[280px] text-[13px] leading-5 text-white/85">
              Funds remain locked in institutional escrow until physical delivery verification.
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            Nigeria&apos;s Secured Multi-Vendor Marketplace
          </p>
          <h1 className="font-display text-5xl font-bold leading-[56px] tracking-tight">
            Find authenticated products.
            <span className="block text-teal">Pay only after physical inspection.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-7 text-ink-secondary">
            Every transaction is held in a protected escrow vault until you receive, examine, and
            approve your order.
          </p>
        </div>
        <form
          onSubmit={submit}
          role="search"
          className="mx-auto mt-8 flex max-w-2xl flex-col items-stretch gap-2 rounded-xl border border-line bg-surface-container-lowest p-2 shadow-md transition-shadow hover:shadow-lg sm:flex-row"
        >
          <label htmlFor="hero-department" className="sr-only">
            Department
          </label>
          <div className="relative shrink-0 border-b border-line/80 sm:border-b-0 sm:border-r">
            <select
              id="hero-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="h-12 w-full cursor-pointer appearance-none rounded-xl bg-transparent px-4 pr-9 text-sm font-medium text-ink focus:outline-none sm:w-auto"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.slug} value={dept.slug}>
                  {dept.name}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none absolute right-2.5 top-3.5 text-[18px] text-ink-muted"
            >
              expand_more
            </span>
          </div>
          <label htmlFor="hero-search" className="sr-only">
            Search products
          </label>
          <div className="relative flex flex-1 items-center px-3">
            <span className="material-symbols-outlined mr-1 text-[20px] text-ink-muted">search</span>
            <input
              id="hero-search"
              ref={inputRef}
              type="search"
              value={query}
              maxLength={MAX_QUERY_LENGTH}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search iPhone 15 Pro, M3 MacBook"
              className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-teal px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-dark"
          >
            <span>Search Products</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
          <kbd
            aria-hidden="true"
            className="mr-1 hidden items-center gap-0.5 self-center rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted lg:flex"
          >
            ⌘K
          </kbd>
        </form>
        <div className="mt-4 flex flex-nowrap items-center gap-2 overflow-x-auto font-mono text-[11px] text-ink-secondary md:flex-wrap md:justify-center">
          <span className="shrink-0 font-medium text-ink-muted">Popular searches:</span>
          {POPULAR.map((term) => (
            <Link
              key={term}
              href={`/products?q=${encodeURIComponent(term)}`}
              className="shrink-0 rounded-lg border border-line/60 bg-card px-2.5 py-1 text-ink transition-all hover:border-teal hover:text-teal"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
