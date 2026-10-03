import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";
import type {
  BankTransferInput,
  BankTransferResult,
  InitializeTransactionInput,
  InitializeTransactionResult,
  PaymentProvider,
  VerifyTransactionResult,
} from "./interfaces/payment-provider.interface";
import { FlutterwaveProvider } from "./providers/flutterwave.provider";
import { PaystackProvider } from "./providers/paystack.provider";

@Injectable()
export class PaymentService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly paystack: PaystackProvider,
    private readonly flutterwave: FlutterwaveProvider,
  ) {}

  activeProvider(): PaymentProvider {
    return this.config.get("PAYMENT_PROVIDER", { infer: true }) === "flutterwave"
      ? this.flutterwave
      : this.paystack;
  }

  initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializeTransactionResult> {
    return this.activeProvider().initializeTransaction(input);
  }

  verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    return this.activeProvider().verifyTransaction(reference);
  }

  initiateBankTransfer(input: BankTransferInput): Promise<BankTransferResult> {
    return this.activeProvider().initiateBankTransfer(input);
  }
}
