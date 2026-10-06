import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { join } from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import type { Env } from "./env.validation";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService<Env, true>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isDev = this.config.get("NODE_ENV", { infer: true }) === "development";
    return {
      ...baseDataSourceOptions(this.config.get("DATABASE_URL", { infer: true })),
      autoLoadEntities: true,
      logging: isDev ? ["warn", "error"] : ["error"],
    };
  }
}

export function baseDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: "postgres",
    url: databaseUrl,
    // Never true — schema changes go through versioned migrations only.
    synchronize: false,
    namingStrategy: new SnakeNamingStrategy(),
  };
}

export function buildDataSource(): DataSource {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/tradeloop";
  const extension = __filename.endsWith(".js") ? "js" : "ts";
  return new DataSource({
    ...baseDataSourceOptions(databaseUrl),
    entities: [join(__dirname, "..", "**", `*.entity.${extension}`)],
    migrations: [join(__dirname, "..", "migrations", `*.${extension}`)],
  });
}
