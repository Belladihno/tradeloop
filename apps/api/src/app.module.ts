import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ClassSerializerInterceptor } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { TypeOrmModule } from "@nestjs/typeorm";
import Redis from "ioredis";
import { validateEnv } from "./config/env.validation";
import { DatabaseConfig } from "./config/database.config";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HealthModule } from "./health/health.module";
import { REDIS_CLIENT, RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
