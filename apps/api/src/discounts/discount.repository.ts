import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { Discount } from "./entities/discount.entity";
import { DiscountRedemption } from "./entities/discount-redemption.entity";

export interface RecordRedemptionData {
  discountId: string;
  orderId: string;
  userId: string;
  amountDeducted: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class DiscountRepository {
  constructor(
    @InjectRepository(Discount) private readonly discounts: Repository<Discount>,
    @InjectRepository(DiscountRedemption)
    private readonly redemptions: Repository<DiscountRedemption>,
  ) {}

  create(data: Partial<Discount>): Promise<Discount> {
    return this.discounts.save(this.discounts.create(data));
  }

  findById(id: string): Promise<Discount | null> {
    return this.discounts.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findActiveByCode(code: string): Promise<Discount | null> {
    return this.discounts.findOne({
      where: { code, isActive: true, deletedAt: IsNull() },
    });
  }

  findActiveAutomatic(): Promise<Discount[]> {
    return this.discounts
      .createQueryBuilder("d")
      .where("d.deletedAt IS NULL")
      .andWhere("d.code IS NULL")
      .andWhere("d.isActive = true")
      .andWhere("d.startsAt <= now()")
      .andWhere("(d.expiresAt IS NULL OR d.expiresAt > now())")
      .orderBy("d.createdAt", "DESC")
      .getMany();
  }

  listByCreator(createdBy: string): Promise<Discount[]> {
    return this.discounts.find({
      where: { createdBy, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  listAll(limit = 100): Promise<Discount[]> {
    return this.discounts.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  countUserRedemptions(discountId: string, userId: string): Promise<number> {
    return this.redemptions.count({ where: { discountId, userId } });
  }

  async claimUsage(id: string, runner: QueryRunner): Promise<boolean> {
    const [records, affected] = (await runner.query(
      `UPDATE "discounts" SET "usage_count" = "usage_count" + 1, "updated_at" = now()
       WHERE "id" = $1 AND "is_active" = true AND "deleted_at" IS NULL
         AND ("max_usage_count" IS NULL OR "usage_count" < "max_usage_count")
       RETURNING "id"`,
      [id],
    )) as [{ id: string }[], number];
    return affected > 0 && records.length > 0;
  }

  recordRedemption(data: RecordRedemptionData, runner: QueryRunner): Promise<DiscountRedemption> {
    return runner.manager.save(
      runner.manager.create(DiscountRedemption, {
        ...data,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      }),
    );
  }

  async deactivate(id: string): Promise<void> {
    await this.discounts.update({ id }, { isActive: false });
  }
}
