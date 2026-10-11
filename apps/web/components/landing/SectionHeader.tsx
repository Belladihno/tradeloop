import Link from "next/link";

export function SectionHeader({
  title,
  sub,
  eyebrow,
  linkHref,
  linkLabel,
}: {
  title: string;
  sub?: string;
  eyebrow?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-amber">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 font-display text-2xl font-semibold md:text-[32px] md:leading-10">
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-ink-secondary">{sub}</p>}
      </div>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="shrink-0 text-sm font-semibold text-teal hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
