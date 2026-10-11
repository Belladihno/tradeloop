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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body text-ink antialiased">{children}</body>
    </html>
  );
}
