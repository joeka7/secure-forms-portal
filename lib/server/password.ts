import "server-only";
import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard, built into Node, no native auth dependency).
 *
 * Stored format: `scrypt$N$r$p$<salt b64>$<hash b64>` with a random 16-byte salt per password, so
 * the cost parameters can be raised later without invalidating existing hashes.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 64 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const encode = (salt: Buffer, hash: Buffer) => ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");

/** Passwords are normalised so the same characters typed on different devices always match. */
const normalize = (password: string) => password.normalize("NFKC");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalize(password), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return encode(salt, hash);
}

/** Synchronous variant, only for one-off bootstrap and seed work at startup. */
export function hashPasswordSync(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(normalize(password), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return encode(salt, hash);
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;
  const actual = await scryptAsync(normalize(password), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;

/**
 * Spends the same work as a real verification against a hash of a random secret. Used when the
 * email is unknown, so response timing does not reveal which accounts exist.
 */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}
