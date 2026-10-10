"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Explore", icon: "storefront" },
  { href: "/products", label: "Search", icon: "category" },
  { href: "/orders", label: "Orders", icon: "swap_horiz" },
  { href: "/wallet", label: "Wallet", icon: "account_balance_wallet" },
  { href: "/dashboard", label: "Account", icon: "manage_accounts" },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 bg-surface/90 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_12px_rgba(0,0,0,0.05)] backdrop-blur-xl md:hidden"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 min-w-[56px] flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "font-semibold text-teal" : "text-ink-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
