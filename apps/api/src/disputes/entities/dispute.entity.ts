import { DisputeStatus } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("disputes")
export class Dispute extends BaseEntity {
  @Column({ type: "uuid" })
  orderId!: string;

  @Column({ type: "uuid" })
  raisedBy!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({
    type: "enum",
    enum: DisputeStatus,
    enumName: "dispute_status",
    default: DisputeStatus.OPEN,
  })
  status!: DisputeStatus;

  @Column({ type: "uuid", nullable: true })
  adminId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  expiryJobId!: string | null;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;
}
