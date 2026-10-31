import { randomBytes } from "node:crypto";

// URL-safe random ID with a readable prefix, e.g. host_Xb3k9QpLm2Zr.
export function randomId(prefix: string, bytes = 9) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

// No look-alike characters (0/o, 1/l/i), so codes are easy to read aloud and type.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Short, unguessable code for invite links, e.g. "k7m2xq9p". */
export function shortCode(length = 8) {
  // Rejection sampling: only bytes below a multiple of the alphabet size, so
  // every character is equally likely (no modulo bias).
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}
