import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { IdempotencyKey } from "./entities/idempotency-key.entity";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyKeysRepository {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly keys: Repository<IdempotencyKey>,
  ) {}

  async findValid(key: string, userId: string): Promise<Record<string, unknown> | null> {
    const stored = await this.keys.findOne({ where: { idempotencyKey: key, userId } });
    if (!stored) return null;
    if (Date.now() - stored.createdAt.getTime() > IDEMPOTENCY_TTL_MS) return null;
    return stored.response;
  }

  async saveIfAbsent(
    key: string,
    userId: string,
    response: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const saved = await this.keys.save(
        this.keys.create({ idempotencyKey: key, userId, response }),
      );
      return saved.response;
    } catch (error) {
      if ((error as { code?: string })?.code !== "23505") throw error;
      const winner = await this.findValid(key, userId);
      if (!winner) throw error;
      return winner;
    }
  }

  async purgeExpired(): Promise<void> {
    await this.keys.delete({ createdAt: LessThan(new Date(Date.now() - IDEMPOTENCY_TTL_MS)) });
  }
}
