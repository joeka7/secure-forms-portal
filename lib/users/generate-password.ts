import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/config";

/**
 * Strong random passwords for the administrator's "Generate password" button.
 *
 * Runs in the browser on the Web Crypto API (cryptographically secure) with rejection sampling, so
 * every character is equally likely. Look-alike characters (0/O, 1/l/I) are left out to make
 * passwords easier to pass on. The result always contains a lowercase letter, an uppercase letter,
 * a digit and a symbol. The password is never stored: it is sent once with the save request and
 * hashed by the server.
 */

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

export const GENERATED_PASSWORD_LENGTH = 18;

function randomIndex(max: number) {
  // Rejection sampling avoids the modulo bias of `value % max`.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

const pick = (chars: string) => chars[randomIndex(chars.length)];

export function generatePassword(length = GENERATED_PASSWORD_LENGTH) {
  const size = Math.min(Math.max(length, PASSWORD_MIN_LENGTH), PASSWORD_MAX_LENGTH);
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  // Fisher–Yates shuffle, so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
