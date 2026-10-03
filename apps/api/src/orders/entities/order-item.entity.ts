import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("order_items")
export class OrderItem extends BaseEntity {
  @Column({ type: "uuid" })
  orderId!: string;

  @Column({ type: "uuid" })
  productId!: string;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  unitPrice!: string;

  @Column({ type: "varchar", length: 200 })
  productName!: string;
}
