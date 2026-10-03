import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("cart_items")
export class CartItem extends BaseEntity {
  @Column({ type: "uuid" })
  cartId!: string;

  @Column({ type: "uuid" })
  productId!: string;

  @Column({ type: "int" })
  quantity!: number;
}
