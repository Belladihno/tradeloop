import { Controller, Get } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StrictThrottle, WriteThrottle } from "./rate-limit";

@Controller("probe")
class ProbeController {
  @StrictThrottle()
  @Get("strict")
  strict(): { ok: boolean } {
    return { ok: true };
  }

  @WriteThrottle()
  @Get("write")
  write(): { ok: boolean } {
    return { ok: true };
  }

  @Get("open")
  open(): { ok: boolean } {
    return { ok: true };
  }
}

describe("rate limits", () => {
  let app: NestFastifyApplication | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: "default", ttl: 60_000, limit: 1000 }],
        }),
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function statusCodes(url: string, count: number): Promise<number[]> {
    if (!app) throw new Error("App not initialized");
    const codes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const res = await app.inject({ method: "GET", url });
      codes.push(res.statusCode);
    }
    return codes;
  }

  it("throttles strict endpoints after 10 requests per minute", async () => {
    const codes = await statusCodes("/probe/strict", 11);
    expect(codes.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(codes[10]).toBe(429);
  });

  it("throttles write endpoints after 30 requests per minute", async () => {
    const codes = await statusCodes("/probe/write", 31);
    expect(codes.slice(0, 30)).toEqual(Array(30).fill(200));
    expect(codes[30]).toBe(429);
  });

  it("leaves undecorated reads on the generous limit", async () => {
    const codes = await statusCodes("/probe/open", 40);
    expect(codes.every((code) => code === 200)).toBe(true);
  });
});
