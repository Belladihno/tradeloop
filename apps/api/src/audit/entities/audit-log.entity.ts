import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("audit_logs")
export class AuditLog extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  actorId!: string | null;

  @Column({ type: "varchar", length: 50 })
  action!: string;

  @Column({ type: "varchar", length: 50 })
  entityType!: string;

  @Column({ type: "uuid", nullable: true })
  entityId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;
}
