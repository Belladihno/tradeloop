import type { UserRole } from "@tradeloop/types";

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  jti: string;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export type VerifiedAccessPayload = AccessTokenPayload & {
  exp: number;
  iat: number;
};

export type VerifiedRefreshPayload = RefreshTokenPayload & {
  exp: number;
  iat: number;
};

export const blocklistKey = (jti: string): string => `blocklist:${jti}`;
