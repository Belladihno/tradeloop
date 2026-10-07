export type AuditAction =
  | "settlement.completed"
  | "payout.requested"
  | "payout.approved"
  | "payout.rejected"
  | "payout.completed"
  | "payout.failed"
  | "refund.issued"
  | "funding.completed"
  | "seller.reviewed"
  | "seller.approved"
  | "seller.rejected"
  | "seller.commission_updated"
  | "dispute.raised"
  | "dispute.resolved"
  | "dispute.expired"
  | "fraud.rule_updated"
  | "webhook.delivery_retried";

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditRecordInput {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}
