export enum SellerStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export interface SellerProfile {
  id: string;
  userId: string;
  storeName: string;
  commissionRate: string;
  status: SellerStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerProfile {
  id: string;
  userId: string;
  defaultShippingAddress: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
