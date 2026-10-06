import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: "node",
    pool: "forks",
    testTimeout: 30_000,
    include: ["src/**/*.spec.ts"],
    env: {
      DATABASE_URL: "postgresql://postgres:password@localhost:5432/tradeloop",
      REDIS_URL: "redis://localhost:16379",
      JWT_SECRET: "test-secret-minimum-32-characters-long",
    },
  },
});
