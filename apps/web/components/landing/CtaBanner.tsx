import Link from "next/link";

const HEADING = "Ready to shop without the fear of fraud?";
const BODY =
  "Experience frictionless e-commerce with built-in escrow protection on every order across Nigeria.";

export function CtaBanner() {
  return (
    <section aria-label="Get started" className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
      <div className="rounded-xl bg-surface-container p-4 shadow-sm md:hidden">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white">
          <span className="material-symbols-outlined text-[24px]">gavel</span>
        </div>
        <h2 className="font-display text-xl font-semibold">{HEADING}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{BODY}</p>
        <div className="flex flex-col gap-2 pt-3">
          <Link
            href="/register"
            className="h-11 w-full rounded-lg bg-amber text-center text-xs font-bold uppercase tracking-wider text-ink shadow-sm"
          >
            <span className="inline-block py-3">Start Buying Safely</span>
          </Link>
          <Link
            href="/register?role=SELLER"
            className="h-11 w-full rounded-lg border border-line bg-surface-container-lowest text-center text-xs font-bold uppercase tracking-wider"
          >
            <span className="inline-block py-3">Become a Verified Seller</span>
          </Link>
        </div>
      </div>
      <div className="hidden flex-col items-start gap-6 rounded-xl bg-teal px-6 py-10 md:flex md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <h2 className="font-display text-2xl font-bold text-white md:text-[32px] md:leading-10">
            {HEADING}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/85">{BODY}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/register"
            className="rounded-lg bg-amber px-5 py-2.5 text-center text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Start Buying Safely
          </Link>
          <Link
            href="/register?role=SELLER"
            className="rounded-lg border border-white/60 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Become a Seller
          </Link>
        </div>
      </div>
    </section>
  );
}
