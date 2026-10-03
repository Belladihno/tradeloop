import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("discount_redemptions")
export class DiscountRedemption extends BaseEntity {
  @Column({ type: "uuid" })
  discountId!: string;

  @Column({ type: "uuid" })
  orderId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  amountDeducted!: string;

  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  userAgent!: string | null;
}
