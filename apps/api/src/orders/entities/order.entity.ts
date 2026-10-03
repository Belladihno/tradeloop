import { OrderStatus, type ShippingAddress } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("orders")
export class Order extends BaseEntity {
  @Column({ type: "uuid" })
  buyerId!: string;

  @Column({ type: "uuid" })
  sellerId!: string;

  @Column({
    type: "enum",
    enum: OrderStatus,
    enumName: "order_status",
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  originalAmount!: string;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  discountedAmount!: string | null;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  totalAmount!: string;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  commissionAmount!: string | null;

  @Column({ type: "jsonb" })
  shippingAddress!: ShippingAddress;
}
