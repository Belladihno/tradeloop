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
    <section className="w-full border-b border-line/60 bg-gradient-to-b from-surface-container-lowest via-surface-container-low/50 to-surface px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
          <span className="material-symbols-outlined text-[14px]">verified_user</span>
          Nigeria&apos;s Secured Multi-Vendor Marketplace
        </p>
        <h1 className="font-display text-[34px] font-bold leading-[42px] tracking-tight md:text-5xl md:leading-[56px]">
          Find authenticated products.
          <span className="block text-teal">Pay only after physical inspection.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-6 text-ink-secondary md:text-lg md:leading-7">
          Every transaction is held in a protected escrow vault until you receive, examine, and
          approve your order.
        </p>
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
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-ink-secondary">
          <span className="font-medium text-ink-muted">Popular searches:</span>
          {POPULAR.map((term) => (
            <Link
              key={term}
              href={`/products?q=${encodeURIComponent(term)}`}
              className="rounded-lg border border-line/60 bg-card px-2.5 py-1 text-ink transition-all hover:border-teal hover:text-teal"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
