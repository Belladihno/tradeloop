"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@tradeloop/utils";
import type { DealProduct } from "@/lib/api-shapes";
import { isDisplayableImage } from "@/lib/images";
import { EscrowBadge } from "@/components/domain/EscrowBadge";
import { StatusPill } from "@/components/domain/StatusPill";

export function ProductListItem({ product }: { product: DealProduct }) {
  const [imageFailed, setImageFailed] = useState(false);
  const soldOut = product.stock <= 0;
  const detailHref = `/products/${encodeURIComponent(product.slug)}`;
  return (
    <article className="flex gap-4 rounded-xl border border-line bg-surface-container-lowest p-3 transition-all hover:shadow-md">
      <Link
        href={detailHref}
        className="relative block h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-container"
        aria-label={product.name}
      >
        {isDisplayableImage(product.imageUrl) && !imageFailed ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="112px"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div role="img" aria-label={`${product.name} image unavailable`} className="flex h-full w-full items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-ink-muted">image</span>
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-ink-muted">
          {product.category?.name ?? "Marketplace"} · <EscrowBadge />
        </p>
        <h3 className="font-display text-base font-semibold leading-6">
          <Link href={detailHref} className="hover:text-teal">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-lg font-semibold text-ink">{formatCurrency(product.price)}</p>
            <StatusPill soldOut={soldOut} />
          </div>
          {soldOut ? (
            <span className="rounded-md bg-surface px-4 py-2 text-sm font-semibold text-ink-muted">
              Unavailable
            </span>
          ) : (
            <Link
              href={detailHref}
              className="flex items-center gap-1 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Buy with Escrow
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
