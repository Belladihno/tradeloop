import { Injectable } from "@nestjs/common";
import { UserRole } from "@tradeloop/types";
import type { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  create(data: Partial<User>): Promise<User> {
    return this.users.create(data);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findByGoogleId(googleId);
  }

  setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    return this.users.setRefreshTokenHash(id, hash);
  }

  setRole(id: string, role: UserRole): Promise<void> {
    return this.users.setRole(id, role);
  }

  linkGoogleId(id: string, googleId: string): Promise<void> {
    return this.users.linkGoogleId(id, googleId);
  }
}
