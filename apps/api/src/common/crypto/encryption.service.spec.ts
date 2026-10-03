import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { EncryptionService } from "./encryption.service";

const FIXED_KEY = "ab".repeat(32);

function serviceWithKey(key: string): EncryptionService {
  const config = { get: () => key };
  return new EncryptionService(config as unknown as ConfigService);
}

describe("EncryptionService", () => {
  it("round-trips account numbers", () => {
    const crypto = serviceWithKey(FIXED_KEY);
    const ciphertext = crypto.encrypt("0123456789");

    expect(ciphertext).not.toBe("0123456789");
    expect(ciphertext.split(":")).toHaveLength(3);
    expect(crypto.decrypt(ciphertext)).toBe("0123456789");
  });

  it("produces unique ciphertexts for the same plaintext", () => {
    const crypto = serviceWithKey(FIXED_KEY);

    expect(crypto.encrypt("0123456789")).not.toBe(crypto.encrypt("0123456789"));
  });

  it("rejects tampered ciphertexts", () => {
    const crypto = serviceWithKey(FIXED_KEY);
    const [iv, data, tag] = crypto.encrypt("0123456789").split(":");

    expect(() => crypto.decrypt(`${iv}:${data}:00${tag.slice(2)}`)).toThrow();
    expect(() => crypto.decrypt("not-a-payload")).toThrow("Invalid encrypted payload");
  });

  it("rejects malformed keys at construction", () => {
    expect(() => serviceWithKey("too-short")).toThrow(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    );
  });

  it("falls back to an ephemeral key when unconfigured", () => {
    const crypto = serviceWithKey("");
    const ciphertext = crypto.encrypt("0123456789");

    expect(crypto.decrypt(ciphertext)).toBe("0123456789");
  });
});
