import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-line/80 bg-surface-container-lowest">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
        <div className="space-y-4">
          <Image src="/logo.svg" alt="Tradeloop" width={140} height={35} className="h-8 w-auto" />
          <p className="max-w-sm text-sm text-ink-secondary">
            Secured multi-vendor escrow marketplace designed for honest commerce. Funds protected,
            verified vendors, seamless settlements.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-ink-secondary">Settlement Rails:</span>
            <span className="rounded border border-line/60 bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold">
              Paystack
            </span>
            <span className="rounded border border-line/60 bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold">
              Flutterwave
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Region &amp; Currency</h3>
          <p className="text-sm text-ink-secondary">
            Currency: <span className="font-mono font-bold text-teal">NGN (₦)</span>
          </p>
          <p className="text-sm text-ink-secondary">
            Region: <span className="font-mono font-bold text-teal">Nigeria (NG)</span>
          </p>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 border-t border-line/60 px-4 py-4 text-sm text-ink-secondary md:flex-row md:px-8">
        <p>© 2026 Tradeloop Technologies Ltd. All rights reserved.</p>
      </div>
    </footer>
  );
}
