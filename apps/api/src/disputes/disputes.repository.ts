import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { DisputeStatus } from "@tradeloop/types";
import { Dispute } from "./entities/dispute.entity";

@Injectable()
export class DisputesRepository {
  constructor(
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
  ) {}

  create(data: Partial<Dispute>, runner?: QueryRunner): Promise<Dispute> {
    const writer = runner ? runner.manager.getRepository(Dispute) : this.disputes;
    return writer.save(this.disputes.create(data));
  }

  findById(id: string): Promise<Dispute | null> {
    return this.disputes.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findOpenByOrder(orderId: string): Promise<Dispute | null> {
    return this.disputes.findOne({
      where: [
        { orderId, status: DisputeStatus.OPEN, deletedAt: IsNull() },
        { orderId, status: DisputeStatus.UNDER_REVIEW, deletedAt: IsNull() },
      ],
    });
  }

  save(dispute: Dispute, runner?: QueryRunner): Promise<Dispute> {
    const writer = runner ? runner.manager.getRepository(Dispute) : this.disputes;
    return writer.save(dispute);
  }
}
