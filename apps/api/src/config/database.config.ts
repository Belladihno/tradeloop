import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
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
    entities: [`${__dirname}/../**/*.entity.{js,ts}`],
    migrations: [`${__dirname}/../migrations/*.{js,ts}`],
  };
}

export function buildDataSource(): DataSource {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/tradeloop";
  return new DataSource({
    ...baseDataSourceOptions(databaseUrl),
    entities: ["src/**/*.entity.ts"],
    migrations: ["src/migrations/*.ts"],
  });
}
