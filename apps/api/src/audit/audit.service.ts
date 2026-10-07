import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { AuditRecordInput } from "@tradeloop/types";
import { AuditLog } from "./entities/audit-log.entity";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.logs.save(
        this.logs.create({
          actorId: input.actorId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(`Audit write failed for ${input.action}: ${(error as Error).message}`);
    }
  }

  list(limit = 100): Promise<AuditLog[]> {
    return this.logs.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
