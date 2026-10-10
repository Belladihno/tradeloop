const ITEMS = [
  {
    icon: "lock",
    title: "Escrow Protected Payments",
    body: "Funds are held in an isolated vault until you inspect the delivery and confirm full satisfaction.",
  },
  {
    icon: "verified_user",
    title: "Verified Nigerian Merchants",
    body: "Every seller passes corporate registration, identity, and bank account screening.",
  },
  {
    icon: "bolt",
    title: "Seller Payouts on Delivery",
    body: "Funds move to the merchant's bank account once you confirm delivery of your order.",
  },
] as const;

export function TrustBar() {
  return (
    <section aria-label="Why Tradeloop" className="w-full border-b border-line/60 bg-card px-4 py-6 md:px-8">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-[22px] text-teal">
              {item.icon}
            </span>
            <div>
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-secondary">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
