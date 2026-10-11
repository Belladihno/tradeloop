import Link from "next/link";

export default function ProductDetailStub({ params }: { params: { slug: string } }) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-16 text-center md:px-8">
      <h1 className="font-display text-2xl font-semibold">Product pages arrive next</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
        You asked for <span className="font-mono">{params.slug}</span> — detail pages with
        gallery, seller strip, and escrow purchase controls land in the next slice.
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
