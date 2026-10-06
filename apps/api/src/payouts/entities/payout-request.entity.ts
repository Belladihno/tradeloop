import { PayoutStatus } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("payout_requests")
export class PayoutRequest extends BaseEntity {
  @Column({ type: "uuid" })
  sellerId!: string;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  amount!: string;

  @Column({
    type: "enum",
    enum: PayoutStatus,
    enumName: "payout_status",
    default: PayoutStatus.PENDING,
  })
  status!: PayoutStatus;

  @Column({ type: "varchar", length: 6 })
  bankCode!: string;

  @Column({ type: "varchar", length: 4 })
  bankAccountLast4!: string;

  @Column({ type: "uuid", nullable: true })
  adminId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: "text", nullable: true })
  failureReason!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  jobId!: string | null;
}
