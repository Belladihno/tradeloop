export enum WalletType {
  BUYER = "BUYER",
  SELLER = "SELLER",
  PLATFORM = "PLATFORM",
  ESCROW = "ESCROW",
}

export enum TransactionType {
  ESCROW_HOLD = "ESCROW_HOLD",
  ESCROW_RELEASE = "ESCROW_RELEASE",
  COMMISSION = "COMMISSION",
  PAYOUT = "PAYOUT",
  REFUND = "REFUND",
  WALLET_FUND = "WALLET_FUND",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REVERSED = "REVERSED",
}

export interface Wallet {
  id: string;
  userId: string | null;
  type: WalletType;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  type: TransactionType;
  status: TransactionStatus;
  referenceId: string;
  referenceType: string;
  createdAt: Date;
  updatedAt: Date;
}
