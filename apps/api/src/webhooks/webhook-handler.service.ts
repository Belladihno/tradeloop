import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { WalletService } from "../wallet/wallet.service";
import { koboToDecimal } from "../payments/providers/paystack.provider";
import { FlutterwaveProvider } from "../payments/providers/flutterwave.provider";
import { PaystackProvider } from "../payments/providers/paystack.provider";

export interface PaystackChargeEvent {
  event?: string;
  data?: { reference?: string; amount?: number };
}

export interface FlutterwaveChargeEvent {
  event?: string;
  data?: { tx_ref?: string; amount?: number | string; status?: string };
}

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    private readonly wallets: WalletService,
    private readonly paystack: PaystackProvider,
    private readonly flutterwave: FlutterwaveProvider,
  ) {}

  async handlePaystackEvent(
    event: PaystackChargeEvent,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<"processed" | "ignored"> {
    if (!this.paystack.verifyWebhook(rawBody, signature)) {
      this.logger.warn("Rejected Paystack webhook with invalid signature");
      throw new UnauthorizedException("Invalid webhook signature");
    }
    if (event?.event !== "charge.success") return "ignored";
    const reference = event.data?.reference;
    const amountKobo = event.data?.amount;
    if (!reference || amountKobo === undefined) return "ignored";
    const result = await this.wallets.confirmFunding(reference, koboToDecimal(amountKobo));
    return result === "completed" ? "processed" : "ignored";
  }

  async handleFlutterwaveEvent(
    event: FlutterwaveChargeEvent,
    signature: string | undefined,
  ): Promise<"processed" | "ignored"> {
    if (!this.flutterwave.verifyWebhook(undefined, signature)) {
      this.logger.warn("Rejected Flutterwave webhook with invalid secret");
      throw new UnauthorizedException("Invalid webhook signature");
    }
    if (event?.event !== "charge.completed" || event.data?.status !== "successful") {
      return "ignored";
    }
    const reference = event.data?.tx_ref;
    const amount = event.data?.amount;
    if (!reference || amount === undefined) return "ignored";
    const result = await this.wallets.confirmFunding(reference, Number(amount).toFixed(2));
    return result === "completed" ? "processed" : "ignored";
  }
}
