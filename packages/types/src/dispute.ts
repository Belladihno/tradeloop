export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED_BUYER = "RESOLVED_BUYER",
  RESOLVED_SELLER = "RESOLVED_SELLER",
  EXPIRED = "EXPIRED",
}

export type DisputeResolution = "BUYER" | "SELLER";

export interface Dispute {
  id: string;
  orderId: string;
  raisedBy: string;
  reason: string;
  status: DisputeStatus;
  adminId: string | null;
  resolvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
