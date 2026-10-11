const STEPS = [
  {
    index: "01",
    icon: "payments",
    title: "Order & Vault Lock",
    body: "Buyer pays securely. Payment is held in an isolated vault, never sent directly to the merchant.",
    tag: "Vault Locked",
  },
  {
    index: "02",
    icon: "local_shipping",
    title: "Merchant Ships",
    body: "Verified seller receives confirmation and dispatches goods with trackable logistics.",
    tag: "Tracked Waybill",
  },
  {
    index: "03",
    icon: "fact_check",
    title: "Inspect & Confirm",
    body: "Buyer inspects the package on arrival and confirms satisfaction before payment moves. Problems go to admin dispute resolution.",
    tag: "Inspection Window",
  },
  {
    index: "04",
    icon: "check_circle",
    title: "Automated Release",
    body: "On buyer confirmation, escrow releases to the seller. Sellers request payouts to their bank.",
    tag: "On Confirmation",
  },
] as const;

export function EscrowSteps() {
  return (
    <section aria-label="How escrow works" className="w-full border-y border-line/60 bg-surface-container-lowest px-4 py-12 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto max-w-xl space-y-2 text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-deep">
            Engineered security rail
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-[32px] md:leading-10">
            How Tradeloop Escrow Works
          </h2>
          <p className="text-sm leading-5 text-ink-secondary">
            Protection from payment checkout to package inspection.
          </p>
        </div>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.index} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-semibold text-teal">{step.index}</p>
                <span className="material-symbols-outlined text-[20px] text-teal">{step.icon}</span>
              </div>
              <h3 className="mt-2 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-1 text-[13px] leading-5 text-ink-secondary">{step.body}</p>
              <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-wider text-teal">
                {step.tag}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
