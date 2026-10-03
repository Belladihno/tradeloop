import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { WalletModule } from "../wallet/wallet.module";
import { SellerProfile } from "./entities/seller-profile.entity";
import { SellerProfilesController } from "./seller-profiles.controller";
import { SellerProfilesRepository } from "./seller-profiles.repository";
import { SellerProfilesService } from "./seller-profiles.service";

@Module({
  imports: [TypeOrmModule.forFeature([SellerProfile]), UsersModule, WalletModule],
  controllers: [SellerProfilesController],
  providers: [SellerProfilesService, SellerProfilesRepository],
  exports: [SellerProfilesService, SellerProfilesRepository],
})
export class SellerProfilesModule {}
