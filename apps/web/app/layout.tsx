import type { Metadata } from "next";
import { body, display, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tradeloop",
  description: "Escrow-protected multi-vendor marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-surface font-body text-ink antialiased">{children}</body>
    </html>
  );
}
