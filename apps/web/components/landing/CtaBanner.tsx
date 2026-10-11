import Link from "next/link";

export function CtaBanner() {
  return (
    <section aria-label="Get started" className="mx-auto max-w-[1280px] px-4 py-12 md:px-8">
      <div className="flex flex-col items-start gap-6 rounded-xl bg-teal px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white md:text-[32px] md:leading-10">
            Ready to shop without the fear of fraud?
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/85">
            Experience frictionless e-commerce with built-in escrow protection on every order
            across Nigeria.
          </p>
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
