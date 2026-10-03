import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderException } from "../common/exceptions/payment-provider.exception";
import {
  koboToDecimal,
  PaystackProvider,
  toKobo,
} from "./providers/paystack.provider";

const SECRET = "sk_test_secret_key";

function setup() {
  const config = {
    get: (key: string): string => {
      if (key === "PAYSTACK_SECRET_KEY") return SECRET;
      throw new Error(`Unexpected config key: ${key}`);
    },
  };
  return new PaystackProvider(config as unknown as ConfigService);
}

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      json: async () => body,
    })),
  );
}

describe("kobo conversion", () => {
  it("converts decimal strings to kobo exactly", () => {
    expect(toKobo("2500.00")).toBe(250000);
    expect(toKobo("2500.99")).toBe(250099);
    expect(toKobo("2500.9")).toBe(250090);
    expect(toKobo("2500")).toBe(250000);
    expect(toKobo("0.01")).toBe(1);
  });

  it("converts kobo back to decimal strings", () => {
    expect(koboToDecimal(250099)).toBe("2500.99");
    expect(koboToDecimal(250000)).toBe("2500.00");
  });
});

describe("PaystackProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies genuine webhook signatures", () => {
    const provider = setup();
    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const signature = createHmac("sha512", SECRET).update(rawBody).digest("hex");

    expect(provider.verifyWebhook(rawBody, signature)).toBe(true);
  });

  it("rejects tampered bodies and missing signatures", () => {
    const provider = setup();
    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const signature = createHmac("sha512", SECRET).update(rawBody).digest("hex");

    expect(provider.verifyWebhook(Buffer.from("tampered"), signature)).toBe(false);
    expect(provider.verifyWebhook(rawBody, undefined)).toBe(false);
    expect(provider.verifyWebhook(undefined, signature)).toBe(false);
    expect(
      provider.verifyWebhook(
        rawBody,
        createHmac("sha512", "other-secret").update(rawBody).digest("hex"),
      ),
    ).toBe(false);
  });

  it("initializes transactions in kobo", async () => {
    const provider = setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        data: { authorization_url: "https://paystack.test/pay/x", reference: "ref-1" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.initializeTransaction({
      amount: "2500.00",
      email: "buyer@tradeloop.test",
      callbackUrl: "http://localhost:3001/wallet",
      reference: "ref-1",
    });

    expect(result).toEqual({ paymentUrl: "https://paystack.test/pay/x", reference: "ref-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(JSON.parse(init.body).amount).toBe(250000);
  });

  it("maps verification statuses", async () => {
    const provider = setup();
    for (const [remote, local] of [
      ["success", "success"],
      ["failed", "failed"],
      ["abandoned", "failed"],
      ["pending", "pending"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            status: true,
            data: { status: remote, amount: 250000, reference: "ref-1" },
          }),
        })),
      );
      const result = await provider.verifyTransaction("ref-1");
      expect(result).toEqual({ status: local, amount: "2500.00", reference: "ref-1" });
    }
  });

  it("throws a provider error on API failures", async () => {
    const provider = setup();
    stubFetch({ status: false, message: "Invalid key" }, false);

    await expect(
      provider.initializeTransaction({
        amount: "2500.00",
        email: "buyer@tradeloop.test",
        callbackUrl: "http://localhost:3001/wallet",
        reference: "ref-1",
      }),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });
});
