import { TransactionStatus, TransactionType } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("transactions")
export class Transaction extends BaseEntity {
  @Column({ type: "uuid" })
  fromWalletId!: string;

  @Column({ type: "uuid" })
  toWalletId!: string;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: "enum", enum: TransactionType, enumName: "transaction_type" })
  type!: TransactionType;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    enumName: "transaction_status",
    default: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @Column({ type: "uuid" })
  referenceId!: string;

  @Column({ type: "varchar", length: 32 })
  referenceType!: string;
}
