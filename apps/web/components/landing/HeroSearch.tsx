"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEPARTMENTS = [
  "All Departments",
  "Phones & Gadgets",
  "Laptops & Tech",
  "Fashion & Apparel",
  "Solar & Power",
  "Home & Office",
] as const;

const POPULAR = ["iPhone 15 Pro", "M3 MacBook Air", "Sony ANC", "5kVA Inverter"] as const;

const MAX_QUERY_LENGTH = 200;

export function HeroSearch() {
  const router = useRouter();
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (department !== DEPARTMENTS[0]) params.set("category", department);
    router.push(`/products?${params.toString()}`);
  }

  return (
    <section className="w-full border-b border-line/60 bg-gradient-to-b from-card via-surface to-surface px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
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
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <label htmlFor="hero-search" className="sr-only">
            Search products
          </label>
          <input
            id="hero-search"
            type="search"
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search iPhone 15 Pro, M3 MacBook"
            className="w-full flex-1 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
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
