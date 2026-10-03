import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import type { Env } from "../../config/env.validation";
import { PaymentProviderException } from "../../common/exceptions/payment-provider.exception";
import type {
  BankTransferInput,
  BankTransferResult,
  InitializeTransactionInput,
  InitializeTransactionResult,
  PaymentProvider,
  VerifiedPaymentStatus,
  VerifyTransactionResult,
} from "../interfaces/payment-provider.interface";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function toKobo(amount: string): number {
  const [naira, kobo = ""] = amount.split(".");
  return Number(naira) * 100 + Number(`${kobo}00`.slice(0, 2));
}

export function koboToDecimal(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack" as const;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializeTransactionResult> {
    const body = await this.post<{ authorization_url: string; reference: string }>(
      "/transaction/initialize",
      {
        email: input.email,
        amount: toKobo(input.amount),
        reference: input.reference,
        callback_url: input.callbackUrl,
      },
    );
    return { paymentUrl: body.authorization_url, reference: body.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const body = await this.get<{
      status: string;
      amount: number;
      reference: string;
    }>(`/transaction/verify/${reference}`);
    return {
      status: mapStatus(body.status),
      amount: koboToDecimal(body.amount),
      reference: body.reference,
    };
  }

  verifyWebhook(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    if (!rawBody || !signature) return false;
    const digest = createHmac("sha512", this.secret).update(rawBody).digest("hex");
    const expected = Buffer.from(digest);
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async initiateBankTransfer(input: BankTransferInput): Promise<BankTransferResult> {
    const recipient = await this.post<{ recipient_code: string }>("/transferrecipient", {
      type: "nuban",
      name: input.accountName,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    });
    const transfer = await this.post<{ transfer_code: string; status: string }>("/transfer", {
      source: "balance",
      amount: toKobo(input.amount),
      recipient: recipient.recipient_code,
      reference: input.reference,
      reason: "Tradeloop seller payout",
    });
    return { transferId: transfer.transfer_code, status: transfer.status };
  }

  private get secret(): string {
    return this.config.get("PAYSTACK_SECRET_KEY", { infer: true });
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.secret}` },
    });
    return this.readBody<T>(response);
  }

  private async post<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return this.readBody<T>(response);
  }

  private async readBody<T>(response: Response): Promise<T> {
    const body = (await response.json()) as PaystackApiResponse<T>;
    if (!response.ok || !body.status) {
      throw new PaymentProviderException(body.message || "Paystack request failed");
    }
    return body.data;
  }
}

function mapStatus(status: string): VerifiedPaymentStatus {
  if (status === "success") return "success";
  if (status === "failed" || status === "abandoned") return "failed";
  return "pending";
}
