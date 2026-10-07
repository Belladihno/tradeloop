import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("fraud_rules")
export class FraudRule extends BaseEntity {
  @Column({ type: "varchar", length: 50, unique: true })
  name!: string;

  @Column({ type: "numeric", precision: 14, scale: 4 })
  threshold!: string;

  @Column({ type: "int" })
  windowSeconds!: number;

  @Column({ type: "boolean", default: true })
  enabled!: boolean;

  @Column({ type: "varchar", length: 500 })
  description!: string;
}
