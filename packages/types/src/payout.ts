export enum PayoutStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}

export interface Payout {
  id: string;
  sellerId: string;
  amount: string;
  status: PayoutStatus;
  bankCode: string;
  bankAccountLast4: string;
  adminId: string | null;
  resolvedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
