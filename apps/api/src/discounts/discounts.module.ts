import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FraudModule } from "../fraud/fraud.module";
import { ProductsModule } from "../products/products.module";
import { DiscountRepository } from "./discount.repository";
import { DiscountService } from "./discount.service";
import { DiscountsController } from "./discounts.controller";
import { Discount } from "./entities/discount.entity";
import { DiscountRedemption } from "./entities/discount-redemption.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Discount, DiscountRedemption]), ProductsModule, FraudModule],
  controllers: [DiscountsController],
  providers: [DiscountService, DiscountRepository],
  exports: [DiscountService, DiscountRepository],
})
export class DiscountsModule {}
