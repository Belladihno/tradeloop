import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { PaymentService } from "./payment.service";
import { FlutterwaveProvider } from "./providers/flutterwave.provider";
import { PaystackProvider } from "./providers/paystack.provider";

function setup(active: "paystack" | "flutterwave" = "paystack") {
  const config = { get: () => active };
  const paystack = { name: "paystack", initializeTransaction: vi.fn() };
  const flutterwave = { name: "flutterwave", initializeTransaction: vi.fn() };
  const service = new PaymentService(
    config as unknown as ConfigService,
    paystack as unknown as PaystackProvider,
    flutterwave as unknown as FlutterwaveProvider,
  );
  return { service, paystack, flutterwave };
}

describe("PaymentService", () => {
  it("delegates to Paystack by default", async () => {
    const { service, paystack, flutterwave } = setup();
    paystack.initializeTransaction.mockResolvedValue({ paymentUrl: "url", reference: "r" });

    await service.initializeTransaction({
      amount: "100.00",
      email: "buyer@tradeloop.test",
      callbackUrl: "http://localhost:3001/wallet",
      reference: "r",
    });

    expect(paystack.initializeTransaction).toHaveBeenCalled();
    expect(flutterwave.initializeTransaction).not.toHaveBeenCalled();
  });

  it("delegates to Flutterwave when configured", async () => {
    const { service, paystack, flutterwave } = setup("flutterwave");
    flutterwave.initializeTransaction.mockResolvedValue({ paymentUrl: "url", reference: "r" });

    await service.initializeTransaction({
      amount: "100.00",
      email: "buyer@tradeloop.test",
      callbackUrl: "http://localhost:3001/wallet",
      reference: "r",
    });

    expect(flutterwave.initializeTransaction).toHaveBeenCalled();
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
  });
});
