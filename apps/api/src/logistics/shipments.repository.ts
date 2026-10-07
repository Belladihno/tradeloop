import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { Shipment } from "./entities/shipment.entity";

@Injectable()
export class ShipmentsRepository {
  constructor(
    @InjectRepository(Shipment) private readonly shipments: Repository<Shipment>,
  ) {}

  create(data: Partial<Shipment>, runner?: QueryRunner): Promise<Shipment> {
    const writer = runner ? runner.manager.getRepository(Shipment) : this.shipments;
    return writer.save(this.shipments.create(data));
  }

  findById(id: string): Promise<Shipment | null> {
    return this.shipments.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findByOrder(orderId: string): Promise<Shipment | null> {
    return this.shipments.findOne({ where: { orderId, deletedAt: IsNull() } });
  }

  findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.shipments.findOne({ where: { trackingNumber, deletedAt: IsNull() } });
  }

  save(shipment: Shipment, runner?: QueryRunner): Promise<Shipment> {
    const writer = runner ? runner.manager.getRepository(Shipment) : this.shipments;
    return writer.save(shipment);
  }
}
