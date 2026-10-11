import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";

const LINKS = DEPARTMENTS.filter((dept) => dept.slug !== "");

export function CategoryNav() {
  return (
    <div className="hidden border-b border-line/40 bg-card md:block">
      <nav
        aria-label="Categories"
        className="mx-auto flex h-11 max-w-[1280px] items-center gap-6 overflow-x-auto whitespace-nowrap px-8 text-xs font-medium text-ink-secondary"
      >
        {LINKS.map((link) => (
          <Link
            key={link.slug}
            href={`/products?category=${encodeURIComponent(link.slug)}`}
            className="transition-colors hover:text-teal"
          >
            {link.name}
          </Link>
        ))}
        <span aria-hidden="true" className="h-3 w-px bg-line" />
        <Link
          href="/register?role=SELLER"
          className="flex items-center gap-1 font-semibold text-teal hover:text-teal-dark"
        >
          <span className="material-symbols-outlined text-[16px]">storefront</span>
          Sell on Tradeloop
        </Link>
      </nav>
    </div>
  );
}
