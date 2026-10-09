import type { ThrottlerStorage } from "@nestjs/throttler";

// Integration suites share one Redis, so real throttle counting would couple
// parallel test files through the same keys. Suites override the storage with
// this inert implementation instead of the guard: the real ThrottlerGuard
// still runs, but every key reports zero hits and never blocks.
export const inertThrottlerStorage: ThrottlerStorage = {
  increment: async () => ({
    totalHits: 0,
    timeToExpire: 0,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};
