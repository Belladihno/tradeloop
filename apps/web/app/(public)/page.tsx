import { Suspense } from "react";
import { HeroSearch } from "@/components/landing/HeroSearch";
import { TrustBar } from "@/components/landing/TrustBar";
import { CategoryGrid } from "@/components/landing/CategoryGrid";
import { CategoryGridSkeleton } from "@/components/landing/CategoryGridSkeleton";

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
    </main>
  );
}
