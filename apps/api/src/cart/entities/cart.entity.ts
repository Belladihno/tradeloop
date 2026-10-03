import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("carts")
export class Cart extends BaseEntity {
  @Column({ type: "uuid" })
  buyerId!: string;
}
