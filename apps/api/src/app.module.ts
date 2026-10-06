import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ClassSerializerInterceptor } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { TypeOrmModule } from "@nestjs/typeorm";
import Redis from "ioredis";
import { existsSync } from "fs";
import { join } from "path";
import { validateEnv } from "./config/env.validation";
import { DatabaseConfig } from "./config/database.config";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { CryptoModule } from "./common/crypto/crypto.module";
import { HealthModule } from "./health/health.module";
import { REDIS_CLIENT, RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { BuyerProfilesModule } from "./buyer-profiles/buyer-profiles.module";
import { CartModule } from "./cart/cart.module";
import { CategoriesModule } from "./categories/categories.module";
import { DiscountsModule } from "./discounts/discounts.module";
import { DisputesModule } from "./disputes/disputes.module";
import { EscrowModule } from "./escrow/escrow.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.module";
import { QueuesModule } from "./queues/queues.module";
import { SellerProfilesModule } from "./seller-profiles/seller-profiles.module";
import { SettlementModule } from "./settlement/settlement.module";
import { UsersModule } from "./users/users.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")].filter(
        (candidate) => existsSync(candidate),
      ),
    }),
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    RedisModule,
    CryptoModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    SellerProfilesModule,
    BuyerProfilesModule,
    AdminModule,
    CartModule,
    OrdersModule,
    IdempotencyModule,
    DiscountsModule,
    EscrowModule,
    SettlementModule,
    DisputesModule,
    QueuesModule,
    WebhooksModule,
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
