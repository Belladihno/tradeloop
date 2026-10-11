import Link from "next/link";

export default function ProductsStub() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-16 text-center md:px-8">
      <h1 className="font-display text-2xl font-semibold">Product browsing arrives next</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
        Listing, search, and filters land in the next build slice. The catalog API is ready —
        this page is waiting on it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
      >
        Back to home
      </Link>
    </main>
  );
}
