import { Suspense } from "react";
import { HeroSearch } from "@/components/landing/HeroSearch";
import { TrustBar } from "@/components/landing/TrustBar";
import { CategoryGrid } from "@/components/landing/CategoryGrid";
import { CategoryGridSkeleton } from "@/components/landing/CategoryGridSkeleton";
import { DealsGrid } from "@/components/landing/DealsGrid";
import { DealsSkeleton } from "@/components/landing/DealsSkeleton";
import { EscrowSteps } from "@/components/landing/EscrowSteps";
import { CtaBanner } from "@/components/landing/CtaBanner";
import { SectionHeader } from "@/components/landing/SectionHeader";

export const revalidate = 60;

export default function LandingPage() {
  return (
    <main>
      <HeroSearch />
      <TrustBar />
      <section aria-label="Browse categories" className="mx-auto max-w-[1280px] px-4 py-12 md:px-8">
        <SectionHeader
          title="Browse Verified Categories"
          sub="Direct from inspected merchants with guaranteed escrow protection."
          linkHref="/products"
          linkLabel="View all categories"
        />
        <div className="mt-6">
          <Suspense fallback={<CategoryGridSkeleton />}>
            <CategoryGrid />
          </Suspense>
        </div>
      </section>
      <section aria-label="Curated deals" className="w-full border-y border-line/60 bg-surface-container-low">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-8">
          <SectionHeader
            eyebrow="Verified escrow inventory"
            title="Curated Marketplace Deals"
            linkHref="/products"
            linkLabel="View all deals"
          />
          <div className="mt-6">
            <Suspense fallback={<DealsSkeleton />}>
              <DealsGrid />
            </Suspense>
          </div>
        </div>
      </section>
      <EscrowSteps />
      <CtaBanner />
    </main>
  );
}
