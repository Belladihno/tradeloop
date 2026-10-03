import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { BuyerProfile } from "./entities/buyer-profile.entity";

@Injectable()
export class BuyerProfilesRepository {
  constructor(
    @InjectRepository(BuyerProfile)
    private readonly profiles: Repository<BuyerProfile>,
  ) {}

  create(data: Partial<BuyerProfile>): Promise<BuyerProfile> {
    return this.profiles.save(this.profiles.create(data));
  }

  findByUserId(userId: string): Promise<BuyerProfile | null> {
    return this.profiles.findOne({ where: { userId, deletedAt: IsNull() } });
  }
}
