import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("flagged_events")
export class FlaggedEvent extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 200 })
  key!: string;

  @Column({ type: "varchar", length: 50 })
  ruleName!: string;

  @Column({ type: "jsonb", nullable: true })
  detail!: Record<string, unknown> | null;
}
