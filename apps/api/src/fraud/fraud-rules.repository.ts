import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { FraudRuleName } from "@tradeloop/types";
import { FraudRule } from "./entities/fraud-rule.entity";

@Injectable()
export class FraudRulesRepository {
  constructor(
    @InjectRepository(FraudRule) private readonly rules: Repository<FraudRule>,
  ) {}

  findByName(name: FraudRuleName): Promise<FraudRule | null> {
    return this.rules.findOne({ where: { name, deletedAt: IsNull() } });
  }

  list(): Promise<FraudRule[]> {
    return this.rules.find({ where: { deletedAt: IsNull() }, order: { name: "ASC" } });
  }

  async update(
    name: FraudRuleName,
    patch: { enabled?: boolean; threshold?: string; windowSeconds?: number },
  ): Promise<FraudRule | null> {
    const rule = await this.findByName(name);
    if (!rule) return null;
    if (patch.enabled !== undefined) rule.enabled = patch.enabled;
    if (patch.threshold !== undefined) rule.threshold = patch.threshold;
    if (patch.windowSeconds !== undefined) rule.windowSeconds = patch.windowSeconds;
    return this.rules.save(rule);
  }
}
