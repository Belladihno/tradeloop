import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BuyerProfilesRepository } from "./buyer-profiles.repository";
import { BuyerProfile } from "./entities/buyer-profile.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BuyerProfile])],
  providers: [BuyerProfilesRepository],
  exports: [BuyerProfilesRepository],
})
export class BuyerProfilesModule {}
