export type ProviderName = "paystack" | "flutterwave";

export interface InitializeTransactionInput {
  amount: string;
  email: string;
  callbackUrl: string;
  reference: string;
}

export interface InitializeTransactionResult {
  paymentUrl: string;
  reference: string;
}

export type VerifiedPaymentStatus = "success" | "failed" | "pending";

export interface VerifyTransactionResult {
  status: VerifiedPaymentStatus;
  amount: string;
  reference: string;
}

export interface BankTransferInput {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  amount: string;
  reference: string;
}

export interface BankTransferResult {
  transferId: string;
  status: string;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  initializeTransaction(input: InitializeTransactionInput): Promise<InitializeTransactionResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  verifyWebhook(rawBody: Buffer | undefined, signature: string | undefined): boolean;
  initiateBankTransfer(input: BankTransferInput): Promise<BankTransferResult>;
}
