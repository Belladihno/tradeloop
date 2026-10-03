import { DiscountScope, DiscountType } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("discounts")
export class Discount extends BaseEntity {
  @Column({ type: "varchar", length: 20, nullable: true, unique: true })
  code!: string | null;

  @Column({ type: "enum", enum: DiscountType, enumName: "discount_type" })
  type!: DiscountType;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  value!: string;

  @Column({ type: "enum", enum: DiscountScope, enumName: "discount_scope" })
  scope!: DiscountScope;

  @Column({ type: "uuid", nullable: true })
  scopeId!: string | null;

  @Column({ type: "uuid" })
  createdBy!: string;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  minimumOrderValue!: string | null;

  @Column({ type: "int", nullable: true })
  maxUsageCount!: number | null;

  @Column({ type: "int", nullable: true })
  maxUsagePerUser!: number | null;

  @Column({ type: "int", default: 0 })
  usageCount!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz" })
  startsAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;
}
