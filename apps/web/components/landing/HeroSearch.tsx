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
    <section className="w-full border-b border-line/60 bg-gradient-to-b from-card via-surface to-surface px-4 py-12 md:px-8 md:py-16">
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
          className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-xl border border-line bg-card p-2 sm:flex-row sm:items-center"
        >
          <label htmlFor="hero-department" className="sr-only">
            Department
          </label>
          <select
            id="hero-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="rounded-lg bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.slug} value={dept.slug}>
                {dept.name}
              </option>
            ))}
          </select>
          <label htmlFor="hero-search" className="sr-only">
            Search products
          </label>
          <input
            id="hero-search"
            ref={inputRef}
            type="search"
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search iPhone 15 Pro, M3 MacBook"
            className="w-full flex-1 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <kbd
            aria-hidden="true"
            className="mr-1 hidden items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted lg:flex"
          >
            ⌘K
          </kbd>
          <button
            type="submit"
            className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
          >
            Search Products
          </button>
        </form>
        <p className="mt-4 text-xs text-ink-muted">
          Popular searches:{" "}
          {POPULAR.map((term, i) => (
            <span key={term}>
              {i > 0 && " · "}
              <Link
                href={`/products?q=${encodeURIComponent(term)}`}
                className="underline-offset-2 hover:text-teal hover:underline"
              >
                {term}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
