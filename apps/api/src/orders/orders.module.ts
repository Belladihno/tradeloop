import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartModule } from "../cart/cart.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { EscrowModule } from "../escrow/escrow.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { ProductsModule } from "../products/products.module";
import { SellerProfilesModule } from "../seller-profiles/seller-profiles.module";
import { OutboundWebhooksModule } from "../webhooks/outbound/outbound-webhooks.module";
import { WalletModule } from "../wallet/wallet.module";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import { OrdersController } from "./orders.controller";
import { OrdersRepository } from "./orders.repository";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    CartModule,
    ProductsModule,
    WalletModule,
    SellerProfilesModule,
    DiscountsModule,
    EscrowModule,
    IdempotencyModule,
    OutboundWebhooksModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
