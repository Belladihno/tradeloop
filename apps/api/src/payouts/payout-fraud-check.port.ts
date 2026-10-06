import { Injectable } from "@nestjs/common";

export interface PayoutFraudScreening {
  suspicious: boolean;
  reason?: string;
}

export interface PayoutFraudCheck {
  screen(sellerId: string, amount: string): Promise<PayoutFraudScreening>;
}

export const PAYOUT_FRAUD_CHECK = "PAYOUT_FRAUD_CHECK";

// Pass-through until Phase 14 lands the real FraudModule; the payout flow
// already screens through this port, so swapping the implementation is enough.
@Injectable()
export class PermissivePayoutFraudCheck implements PayoutFraudCheck {
  async screen(): Promise<PayoutFraudScreening> {
    return { suspicious: false };
  }
}
