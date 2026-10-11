const ITEMS = [
  {
    icon: "lock",
    title: "Escrow Protected Payments",
    body: "Funds are held in an isolated vault until you inspect the delivery and confirm full satisfaction.",
    short: "Escrow Vault",
    sub: "Held till inspection",
  },
  {
    icon: "verified_user",
    title: "Verified Nigerian Merchants",
    body: "Every seller passes corporate registration, identity, and bank account screening.",
    short: "CAC & BVN",
    sub: "100% vetted sellers",
  },
  {
    icon: "bolt",
    title: "Seller Payouts on Delivery",
    body: "Once you confirm delivery, funds settle to the seller, who can request payouts to their bank account.",
    short: "Fast Payout",
    sub: "Released on confirmation",
  },
] as const;

export function TrustBar() {
  return (
    <section aria-label="Why Tradeloop" className="w-full border-b border-line/60 bg-surface px-4 py-4 md:bg-surface-container-lowest md:px-8 md:py-6">
      <div className="mx-auto grid max-w-[1280px] grid-cols-3 gap-2 md:gap-6 md:divide-x md:divide-line/60">
        {ITEMS.map((item) => (
          <div key={item.title}>
            <div className="flex flex-col items-center rounded-lg bg-surface-container-lowest p-1 text-center shadow-sm md:hidden">
              <span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-teal">
                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              </span>
              <span className="text-[11px] font-semibold leading-tight">{item.short}</span>
              <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink-secondary">
                {item.sub}
              </span>
            </div>
            <div className="hidden items-start gap-3 px-6 first:pl-0 last:pr-0 md:flex">
              <span className="material-symbols-outlined mt-0.5 text-[22px] text-teal">
                {item.icon}
              </span>
              <div>
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-[13px] leading-5 text-ink-secondary">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
