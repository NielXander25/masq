import { randomBytes } from "node:crypto";

// URL-safe random ID with a readable prefix, e.g. host_Xb3k9QpLm2Zr.
export function randomId(prefix: string, bytes = 9) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

// No look-alike characters (0/o, 1/l/i), so codes are easy to read aloud and type.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Short, unguessable code for invite links, e.g. "k7m2xq9p". */
export function shortCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}
