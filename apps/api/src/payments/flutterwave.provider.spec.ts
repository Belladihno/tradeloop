import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderException } from "../common/exceptions/payment-provider.exception";
import { FlutterwaveProvider } from "./providers/flutterwave.provider";

const API_SECRET = "FLWSECK_TEST-secret";
const WEBHOOK_SECRET = "webhook-secret";

function setup() {
  const config = {
    get: (key: string): string => {
      if (key === "FLUTTERWAVE_SECRET_KEY") return API_SECRET;
      if (key === "FLUTTERWAVE_WEBHOOK_SECRET") return WEBHOOK_SECRET;
      throw new Error(`Unexpected config key: ${key}`);
    },
  };
  return new FlutterwaveProvider(config as unknown as ConfigService);
}

describe("FlutterwaveProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts matching webhook secrets", () => {
    expect(setup().verifyWebhook(undefined, WEBHOOK_SECRET)).toBe(true);
  });

  it("rejects mismatched and missing secrets", () => {
    const provider = setup();

    expect(provider.verifyWebhook(undefined, "wrong")).toBe(false);
    expect(provider.verifyWebhook(undefined, undefined)).toBe(false);
  });

  it("initializes transactions with the client reference", async () => {
    const provider = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "success",
          data: { link: "https://flutterwave.test/pay/x" },
        }),
      })),
    );

    const result = await provider.initializeTransaction({
      amount: "2500.00",
      email: "buyer@tradeloop.test",
      callbackUrl: "http://localhost:3001/wallet",
      reference: "ref-1",
    });

    expect(result).toEqual({ paymentUrl: "https://flutterwave.test/pay/x", reference: "ref-1" });
  });

  it("maps verification statuses", async () => {
    const provider = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "success",
          data: { status: "successful", amount: 2500, tx_ref: "ref-1" },
        }),
      })),
    );

    const result = await provider.verifyTransaction("ref-1");
    expect(result).toEqual({ status: "success", amount: "2500.00", reference: "ref-1" });
  });

  it("throws a provider error on API failures", async () => {
    const provider = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ status: "error", message: "Bad request" }),
      })),
    );

    await expect(provider.verifyTransaction("ref-1")).rejects.toBeInstanceOf(
      PaymentProviderException,
    );
  });
});
