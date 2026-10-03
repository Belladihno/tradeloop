import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
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

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

interface FlutterwaveApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

@Injectable()
export class FlutterwaveProvider implements PaymentProvider {
  readonly name = "flutterwave" as const;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializeTransactionResult> {
    const body = await this.post<{ link: string }>(`/payments`, {
      tx_ref: input.reference,
      amount: input.amount,
      currency: "NGN",
      redirect_url: input.callbackUrl,
      customer: { email: input.email },
    });
    return { paymentUrl: body.link, reference: input.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const body = await this.get<{
      status: string;
      amount: number;
      tx_ref: string;
    }>(`/transactions/${reference}/verify`);
    return {
      status: mapStatus(body.status),
      amount: Number(body.amount).toFixed(2),
      reference: body.tx_ref,
    };
  }

  verifyWebhook(_rawBody: Buffer | undefined, signature: string | undefined): boolean {
    const secret = this.config.get("FLUTTERWAVE_WEBHOOK_SECRET", { infer: true });
    if (!secret || !signature) return false;
    const expected = Buffer.from(secret);
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async initiateBankTransfer(input: BankTransferInput): Promise<BankTransferResult> {
    const body = await this.post<{ id: number; status: string }>(`/transfers`, {
      account_bank: input.bankCode,
      account_number: input.accountNumber,
      amount: Number(input.amount),
      narration: "Tradeloop seller payout",
      currency: "NGN",
      reference: input.reference,
    });
    return { transferId: String(body.id), status: body.status };
  }

  private get secret(): string {
    return this.config.get("FLUTTERWAVE_SECRET_KEY", { infer: true });
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.secret}` },
    });
    return this.readBody<T>(response);
  }

  private async post<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}${path}`, {
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
    const body = (await response.json()) as FlutterwaveApiResponse<T>;
    if (!response.ok || body.status !== "success") {
      throw new PaymentProviderException(body.message || "Flutterwave request failed");
    }
    return body.data;
  }
}

function mapStatus(status: string): VerifiedPaymentStatus {
  if (status === "successful") return "success";
  if (status === "failed" || status === "cancelled") return "failed";
  return "pending";
}
