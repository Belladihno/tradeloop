import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  create(data: Partial<User>): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email, deletedAt: IsNull() } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findOne({ where: { googleId, deletedAt: IsNull() } });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.users.update({ id }, { refreshTokenHash: hash });
  }

  async linkGoogleId(id: string, googleId: string): Promise<void> {
    await this.users.update({ id }, { googleId });
  }
}
