import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("products")
export class Product extends BaseEntity {
  @Column({ type: "uuid" })
  sellerId!: string;

  @Column({ type: "uuid" })
  categoryId!: string;

  @Column({ type: "varchar", length: 200 })
  name!: string;

  @Column({ type: "varchar", length: 220 })
  slug!: string;

  @Column({ type: "text", default: "" })
  description!: string;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  price!: string;

  @Column({ type: "int", default: 0 })
  stock!: number;

  @Column({ type: "varchar", nullable: true })
  imageUrl!: string | null;

  @Column({ type: "tsvector", nullable: true, select: false })
  searchVector!: string | null;
}
