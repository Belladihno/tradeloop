import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { FraudRuleName } from "@tradeloop/types";
import { FlaggedEvent } from "./entities/flagged-event.entity";

@Injectable()
export class FlaggedEventsRepository {
  constructor(
    @InjectRepository(FlaggedEvent) private readonly events: Repository<FlaggedEvent>,
  ) {}

  create(data: {
    userId: string | null;
    key: string;
    ruleName: FraudRuleName;
    detail?: Record<string, unknown>;
  }): Promise<FlaggedEvent> {
    return this.events.save(this.events.create({ ...data, detail: data.detail ?? null }));
  }

  list(limit = 100): Promise<FlaggedEvent[]> {
    return this.events.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
