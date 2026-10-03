import { v7 as uuidv7 } from "uuid";
import {
  Column,
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export abstract class BaseEntity {
  @PrimaryColumn({ type: "uuid" })
  id: string = uuidv7();

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  // Manual column: @DeleteDateColumn breaks unique constraints on re-registration,
  // so queries filter `deletedAt IS NULL` explicitly.
  @Column({ type: "timestamptz", nullable: true, default: null })
  deletedAt!: Date | null;
}
