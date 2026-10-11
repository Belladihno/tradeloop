import type { Config } from "tailwindcss";
import uiConfig from "@tradeloop/ui/tailwind.config";

const config: Config = {
  presets: [uiConfig],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
