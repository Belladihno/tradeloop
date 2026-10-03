import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { Env } from "../../config/env.validation";

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly logger = new Logger(EncryptionService.name);

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get("ENCRYPTION_KEY", { infer: true });
    if (!raw) {
      this.key = randomBytes(32);
      this.logger.warn(
        "ENCRYPTION_KEY is not set — using an ephemeral key. Encrypted data will not survive restarts",
      );
      return;
    }
    const key = Buffer.from(raw, "hex");
    if (key.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
  }

  decrypt(payload: string): string {
    const [ivHex, dataHex, tagHex] = payload.split(":");
    if (!ivHex || !dataHex || !tagHex) {
      throw new Error("Invalid encrypted payload");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
