import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { PayoutStatus } from "@tradeloop/types";
import { PayoutRequest } from "./entities/payout-request.entity";

@Injectable()
export class PayoutsRepository {
  constructor(
    @InjectRepository(PayoutRequest) private readonly payouts: Repository<PayoutRequest>,
  ) {}

  create(data: Partial<PayoutRequest>, runner?: QueryRunner): Promise<PayoutRequest> {
    const writer = runner ? runner.manager.getRepository(PayoutRequest) : this.payouts;
    return writer.save(this.payouts.create(data));
  }

  findById(id: string): Promise<PayoutRequest | null> {
    return this.payouts.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findBySeller(sellerId: string): Promise<PayoutRequest[]> {
    return this.payouts.find({
      where: { sellerId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  save(payout: PayoutRequest, runner?: QueryRunner): Promise<PayoutRequest> {
    const writer = runner ? runner.manager.getRepository(PayoutRequest) : this.payouts;
    return writer.save(payout);
  }
}
