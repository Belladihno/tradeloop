"use client";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-center">
      <h2 className="font-display text-2xl font-semibold">Something went wrong loading this page</h2>
      <p className="mt-2 text-sm text-ink-secondary">
        {error.message || "Please try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
      >
        Try again
      </button>
    </div>
  );
}
