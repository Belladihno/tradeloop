const STEPS = [
  {
    index: "01",
    title: "Order & Vault Lock",
    body: "Buyer pays securely. Payment is held in an isolated vault, never sent directly to the merchant.",
    tag: "Vault Locked",
  },
  {
    index: "02",
    title: "Merchant Ships",
    body: "Verified seller receives confirmation and dispatches goods with trackable logistics.",
    tag: "Tracked Waybill",
  },
  {
    index: "03",
    title: "Inspect & Confirm",
    body: "Buyer inspects the package on arrival and confirms satisfaction before payment moves. Problems go to admin dispute resolution.",
    tag: "Inspection Window",
  },
  {
    index: "04",
    title: "Automated Release",
    body: "On buyer confirmation, escrow releases to the seller. Sellers request payouts to their bank.",
    tag: "Instant Settlement",
  },
] as const;

export function EscrowSteps() {
  return (
    <section aria-label="How escrow works" className="w-full border-y border-line/60 bg-card px-4 py-12 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-amber">
          Engineered security rail
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold md:text-[32px] md:leading-10">
          How Tradeloop Escrow Works
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Protection from payment checkout to package inspection.
        </p>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.index} className="rounded-lg border border-line bg-surface p-5">
              <p className="font-mono text-xs font-semibold text-teal">{step.index}</p>
              <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-[13px] leading-5 text-ink-secondary">{step.body}</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-amber">
                {step.tag}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
