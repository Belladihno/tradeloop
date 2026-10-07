import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { Env } from "../config/env.validation";
import { OrdersModule } from "../orders/orders.module";
import { Shipment } from "./entities/shipment.entity";
import {
  LOGISTICS_PROVIDER,
  type LogisticsProvider,
} from "./interfaces/logistics-provider.interface";
import { LogisticsController } from "./logistics.controller";
import { LogisticsService } from "./logistics.service";
import { MockLogisticsProvider } from "./providers/mock-logistics.provider";
import { SendboxProvider } from "./providers/sendbox.provider";
import { ShipmentsRepository } from "./shipments.repository";

function buildProvider(config: ConfigService<Env, true>): LogisticsProvider {
  if (config.get("LOGISTICS_PROVIDER", { infer: true }) === "sendbox") {
    return new SendboxProvider(config);
  }
  return new MockLogisticsProvider();
}

@Module({
  imports: [TypeOrmModule.forFeature([Shipment]), OrdersModule],
  controllers: [LogisticsController],
  providers: [
    LogisticsService,
    ShipmentsRepository,
    { provide: LOGISTICS_PROVIDER, inject: [ConfigService], useFactory: buildProvider },
  ],
  exports: [LogisticsService],
})
export class LogisticsModule {}
