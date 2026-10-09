import { Throttle } from "@nestjs/throttler";

const MINUTE_MS = 60_000;

// Global default (see AppModule) is generous: 100 requests per minute, and it
// stays active on every route. These overrides tighten the "default" throttler
// for brute-force targets (auth) and state-changing writes. Reads inherit the
// global limit and need no decorator.
export const StrictThrottle = (): MethodDecorator & ClassDecorator =>
  Throttle({ default: { limit: 10, ttl: MINUTE_MS } });

export const WriteThrottle = (): MethodDecorator & ClassDecorator =>
  Throttle({ default: { limit: 30, ttl: MINUTE_MS } });
