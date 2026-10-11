"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@tradeloop/utils";
import type { DealProduct } from "@/lib/api-shapes";
import { isDisplayableImage } from "@/lib/images";
import { EscrowBadge } from "./EscrowBadge";
import { StatusPill } from "./StatusPill";

export function ProductCard({ product }: { product: DealProduct }) {
  const [imageFailed, setImageFailed] = useState(false);
  const soldOut = product.stock <= 0;
  const detailHref = `/products/${encodeURIComponent(product.slug)}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-line bg-card transition-colors hover:border-teal">
      <Link
        href={detailHref}
        className="relative block aspect-[4/3] bg-surface"
        aria-label={product.name}
      >
        {isDisplayableImage(product.imageUrl) && !imageFailed ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div role="img" aria-label={`${product.name} image unavailable`} className="flex h-full w-full items-center justify-center">
            <span className="material-symbols-outlined text-[40px] text-ink-muted">image</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs text-ink-muted">
          {product.category?.name ?? "Marketplace"} · <EscrowBadge />
        </p>
        <h3 className="font-display text-base font-semibold leading-6">
          <Link href={detailHref} className="hover:text-teal">
            {product.name}
          </Link>
        </h3>
        <p className="font-display text-xl font-semibold text-ink">{formatCurrency(product.price)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <StatusPill soldOut={soldOut} />
          {soldOut ? (
            <span className="rounded-md bg-surface px-4 py-2 text-sm font-semibold text-ink-muted">
              Unavailable
            </span>
          ) : (
            <Link
              href={detailHref}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark"
            >
              Buy with Escrow
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
