import { UserRole } from "@tradeloop/types";
import { Exclude } from "class-transformer";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("users")
export class User extends BaseEntity {
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Exclude()
  @Column({ type: "varchar", nullable: true })
  passwordHash!: string | null;

  @Column({ type: "varchar", nullable: true })
  googleId!: string | null;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "user_role",
    default: UserRole.BUYER,
  })
  role!: UserRole;

  @Column({ type: "boolean", default: false })
  isVerified!: boolean;

  @Exclude()
  @Column({ type: "varchar", nullable: true })
  refreshTokenHash!: string | null;
}
