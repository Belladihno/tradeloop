import Link from "next/link";

export default function StorefrontStub({ params }: { params: { storeName: string } }) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-16 text-center md:px-8">
      <h1 className="font-display text-2xl font-semibold">Seller storefronts arrive next</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
        You asked for <span className="font-mono">{params.storeName}</span> — verified
        storefronts land in the seller slice.
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
