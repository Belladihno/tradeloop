import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  create(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email, deletedAt: IsNull() } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.repo.findOne({ where: { googleId, deletedAt: IsNull() } });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.repo.update({ id }, { refreshTokenHash: hash });
  }

  async linkGoogleId(id: string, googleId: string): Promise<void> {
    await this.repo.update({ id }, { googleId });
  }
}
