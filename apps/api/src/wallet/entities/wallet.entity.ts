import { WalletType } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("wallets")
export class Wallet extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "enum", enum: WalletType, enumName: "wallet_type" })
  type!: WalletType;

  @Column({ type: "numeric", precision: 14, scale: 2, default: "0.00" })
  balance!: string;
}
