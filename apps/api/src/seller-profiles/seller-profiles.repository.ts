import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { SellerProfile } from "./entities/seller-profile.entity";

@Injectable()
export class SellerProfilesRepository {
  constructor(
    @InjectRepository(SellerProfile)
    private readonly profiles: Repository<SellerProfile>,
  ) {}

  create(data: Partial<SellerProfile>): Promise<SellerProfile> {
    return this.profiles.save(this.profiles.create(data));
  }

  findById(id: string): Promise<SellerProfile | null> {
    return this.profiles.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findByUserId(userId: string): Promise<SellerProfile | null> {
    return this.profiles.findOne({ where: { userId, deletedAt: IsNull() } });
  }

  save(profile: SellerProfile): Promise<SellerProfile> {
    return this.profiles.save(profile);
  }
}
