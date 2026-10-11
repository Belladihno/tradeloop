import Link from "next/link";

export function SectionHeader({
  title,
  titleMobile,
  sub,
  eyebrow,
  linkHref,
  linkLabel,
  linkLabelMobile,
  dot,
}: {
  title: string;
  titleMobile?: string;
  sub?: string;
  eyebrow?: string;
  linkHref?: string;
  linkLabel?: string;
  linkLabelMobile?: string;
  dot?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-amber">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 flex items-center gap-1.5 font-display text-xl font-semibold md:text-[32px] md:leading-10">
          {dot && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber md:hidden" />}
          {titleMobile && <span className="md:hidden">{titleMobile}</span>}
          <span className={titleMobile ? "hidden md:inline" : undefined}>{title}</span>
        </h2>
        {sub && <p className="mt-1 hidden text-sm text-ink-secondary md:block">{sub}</p>}
      </div>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-teal hover:underline"
        >
          <span className="md:hidden">{linkLabelMobile ?? linkLabel}</span>
          <span className="hidden md:inline">{linkLabel}</span>
          <span className="material-symbols-outlined text-[14px] md:hidden">arrow_forward</span>
          <span aria-hidden="true" className="hidden md:inline"> →</span>
        </Link>
      )}
    </div>
  );
}
