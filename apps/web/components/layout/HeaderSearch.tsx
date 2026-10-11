"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_QUERY_LENGTH = 200;

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/products?q=${encodeURIComponent(q.slice(0, MAX_QUERY_LENGTH))}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="hidden max-w-xl flex-1 items-center md:flex"
    >
      <label htmlFor="header-search" className="sr-only">
        Search products
      </label>
      <div className="flex w-full items-center rounded-xl border border-line/70 bg-surface-container-low px-3 py-1.5 transition-all focus-within:border-teal focus-within:bg-surface-container-lowest">
        <span className="material-symbols-outlined mr-1 text-[20px] text-ink-muted">search</span>
        <input
          id="header-search"
          type="search"
          value={query}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search authenticated products or sellers..."
          className="w-full bg-transparent py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>
    </form>
  );
}
