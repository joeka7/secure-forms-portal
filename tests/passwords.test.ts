import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH } from "@/lib/config";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/server/password";
import { GENERATED_PASSWORD_LENGTH, generatePassword } from "@/lib/users/generate-password";

describe("password hashing", () => {
  it("hashes with scrypt and a random salt per password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
  });

  it("normalises Unicode so equivalent input matches", async () => {
    const hash = await hashPassword("café-password");
    expect(await verifyPassword("café-password", hash)).toBe(true);
  });

  it("rejects malformed stored hashes and spends work on unknown accounts", async () => {
    expect(await verifyPassword("anything", "plaintext")).toBe(false);
    expect(await burnPasswordCheck("anything")).toBe(false);
  });
});

describe("generatePassword", () => {
  it("produces strong, varied passwords from every character class", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const password = generatePassword();
      expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[!@#$%^&*\-_=+?]/);
      expect(password).not.toMatch(/[0O1lI]/);
      seen.add(password);
    }
    expect(seen.size).toBe(200);
  });

  it("never goes below the minimum length", () => {
    expect(generatePassword(4)).toHaveLength(PASSWORD_MIN_LENGTH);
  });
});
