import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("categories")
export class Category extends BaseEntity {
  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 140 })
  slug!: string;

  @Column({ type: "uuid", nullable: true })
  parentId!: string | null;
}
