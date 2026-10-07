import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import type Redis from "ioredis";
import type { Env } from "../config/env.validation";
import { REDIS_CLIENT } from "../redis/redis.module";

export interface DependencyStatus {
  status: "up" | "down" | "skipped";
  latencyMs?: number;
}

export interface HealthReport {
  status: "ok" | "degraded";
  timestamp: string;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
    supabase: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis, supabase] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkSupabase(),
    ]);
    const degraded = [database, redis, supabase].some((check) => check.status === "down");
    return {
      status: degraded ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      checks: { database, redis, supabase },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      await this.dataSource.query("SELECT 1");
      return { status: "up", latencyMs: Date.now() - started };
    } catch (error) {
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      return { status: "down" };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      await this.redis.ping();
      return { status: "up", latencyMs: Date.now() - started };
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      return { status: "down" };
    }
  }

  private async checkSupabase(): Promise<DependencyStatus> {
    const url = this.config.get("SUPABASE_URL", { infer: true });
    const key = this.config.get("SUPABASE_ANON_KEY", { infer: true });
    if (!url || !key) return { status: "skipped" };
    const started = Date.now();
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      await res.arrayBuffer().then((buffer) => buffer.byteLength);
      return { status: "up", latencyMs: Date.now() - started };
    } catch (error) {
      this.logger.warn(`Supabase health check failed: ${(error as Error).message}`);
      return { status: "down" };
    }
  }
}
