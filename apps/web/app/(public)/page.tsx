import { Suspense } from "react";
import Link from "next/link";
import { HeroSearch } from "@/components/landing/HeroSearch";
import { TrustBar } from "@/components/landing/TrustBar";
import { CategoryGrid } from "@/components/landing/CategoryGrid";
import { CategoryGridSkeleton } from "@/components/landing/CategoryGridSkeleton";
import { DealsGrid } from "@/components/landing/DealsGrid";
import { DealsSkeleton } from "@/components/landing/DealsSkeleton";

export const revalidate = 60;

export default function LandingPage() {
  return (
    <main>
      <HeroSearch />
      <TrustBar />
      <section aria-label="Browse categories" className="mx-auto max-w-[1280px] px-4 py-12 md:px-8">
        <h2 className="font-display text-2xl font-semibold md:text-[32px] md:leading-10">
          Browse Verified Categories
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Direct from inspected merchants with guaranteed escrow protection.
        </p>
        <div className="mt-6">
          <Suspense fallback={<CategoryGridSkeleton />}>
            <CategoryGrid />
          </Suspense>
        </div>
      </section>
      <section aria-label="Curated deals" className="mx-auto max-w-[1280px] px-4 pb-12 md:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-amber">
              Verified escrow inventory
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold md:text-[32px] md:leading-10">
              Curated Marketplace Deals
            </h2>
          </div>
          <Link href="/products" className="shrink-0 text-sm font-semibold text-teal hover:underline">
            View all deals →
          </Link>
        </div>
        <div className="mt-6">
          <Suspense fallback={<DealsSkeleton />}>
            <DealsGrid />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
