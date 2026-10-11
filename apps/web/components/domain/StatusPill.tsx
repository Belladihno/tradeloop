export function StatusPill({ soldOut }: { soldOut: boolean }) {
  if (!soldOut) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-error/25 bg-error-container px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-error">
      Out of stock
    </span>
  );
}
