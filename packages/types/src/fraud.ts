export type FraudRuleName =
  | "order-velocity"
  | "payout-velocity"
  | "amount-anomaly"
  | "new-account-high-value"
  | "login-burst"
  | "discount-abuse"
  | "dispute-rate";

export interface FraudScreening {
  suspicious: boolean;
  rule?: FraudRuleName;
  reason?: string;
}

export interface FraudRule {
  id: string;
  name: FraudRuleName;
  threshold: string;
  windowSeconds: number;
  enabled: boolean;
  description: string;
}

export interface FlaggedEvent {
  id: string;
  userId: string | null;
  key: string;
  ruleName: FraudRuleName;
  detail: Record<string, unknown> | null;
  createdAt: Date;
}
