import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("idempotency_keys")
export class IdempotencyKey extends BaseEntity {
  @Column({ type: "varchar", length: 100 })
  idempotencyKey!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "jsonb" })
  response!: Record<string, unknown>;
}
