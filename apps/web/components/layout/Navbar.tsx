import Image from "next/image";
import Link from "next/link";
import { HeaderSearch } from "./HeaderSearch";
import { CategoryNav } from "./CategoryNav";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-surface-container-lowest/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 md:h-20 md:px-8">
        <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-90">
          <Image src="/logo.svg" alt="Tradeloop" width={160} height={40} className="h-8 w-auto md:h-9" priority />
        </Link>
        <HeaderSearch />
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <span className="hidden items-center gap-1 rounded-full border border-teal/20 bg-teal/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal sm:flex">
            <span className="material-symbols-outlined text-[15px]">shield</span>
            Escrow Guaranteed
          </span>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="p-2 text-ink-secondary transition-colors hover:text-ink"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="p-2 text-ink-secondary transition-colors hover:text-ink"
          >
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
          >
            Sign in
          </Link>
        </div>
      </div>
      <CategoryNav />
    </header>
  );
}
