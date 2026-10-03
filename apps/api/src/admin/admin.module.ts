import { Module } from "@nestjs/common";
import { SellerProfilesModule } from "../seller-profiles/seller-profiles.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [SellerProfilesModule],
  controllers: [AdminController],
})
export class AdminModule {}
