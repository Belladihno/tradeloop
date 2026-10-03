export enum UserRole {
  BUYER = "BUYER",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
