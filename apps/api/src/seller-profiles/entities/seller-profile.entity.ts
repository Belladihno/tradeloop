import { SellerStatus } from "@tradeloop/types";
import { Exclude } from "class-transformer";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("seller_profiles")
export class SellerProfile extends BaseEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 100 })
  storeName!: string;

  @Exclude()
  @Column({ type: "varchar", nullable: true })
  bankAccountNumber!: string | null;

  @Column({ type: "varchar", length: 6, nullable: true })
  bankCode!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  webhookUrl!: string | null;

  @Exclude()
  @Column({ type: "varchar", length: 500, nullable: true })
  webhookSecret!: string | null;

  @Column({ type: "numeric", precision: 5, scale: 4, default: "0.1000" })
  commissionRate!: string;

  @Column({
    type: "enum",
    enum: SellerStatus,
    enumName: "seller_status",
    default: SellerStatus.PENDING_VERIFICATION,
  })
  status!: SellerStatus;

  @Column({ type: "text", nullable: true })
  rejectionReason!: string | null;
}
