import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#0D6E6E",
          light: "#E8F5F5",
          dark: "#095555",
        },
        amber: {
          DEFAULT: "#E8A020",
          light: "#FDF3E3",
          // Deep amber-brown for small text on light surfaces. #E8A020
          // fails contrast below ~14px; this is the Stitch secondary token.
          deep: "#815500",
        },
        surface: "#F9F7F4",
        // Layered surfaces from the Stitch master (DESIGN.md). `surface`
        // stays the page canvas; these separate floating chrome (header,
        // trust bar, footer) and sunken bands (deals) from it.
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3f3",
        "surface-container": "#efeded",
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#4A4A4A",
          muted: "#8A8A8A",
        },
        line: "#D4D4D4",
        card: "#F0EEEC",
        success: "#1A7F5A",
        error: "#C0392B",
        warning: "#D4850A",
        info: "#1A5F8A",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      fontSize: {
        caption: "12px",
        table: "14px",
        body: "16px",
        subhead: "18px",
        cardtitle: "24px",
        pagehead: "32px",
        display: "48px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
