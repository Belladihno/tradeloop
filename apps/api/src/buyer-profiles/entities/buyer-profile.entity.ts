import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("buyer_profiles")
export class BuyerProfile extends BaseEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "jsonb", nullable: true })
  defaultShippingAddress!: Record<string, unknown> | null;
}
