import { ShipmentStatus } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("shipments")
export class Shipment extends BaseEntity {
  @Column({ type: "uuid", unique: true })
  orderId!: string;

  @Column({ type: "varchar", length: 20 })
  provider!: string;

  @Column({ type: "varchar", length: 100, unique: true })
  trackingNumber!: string;

  @Column({
    type: "enum",
    enum: ShipmentStatus,
    enumName: "shipment_status",
    default: ShipmentStatus.PENDING,
  })
  status!: ShipmentStatus;

  @Column({ type: "numeric", precision: 14, scale: 2 })
  rateAmount!: string;
}
