import { randomBytes } from "node:crypto";

// URL-safe random ID with a readable prefix, e.g. host_Xb3k9QpLm2Zr.
export function randomId(prefix: string, bytes = 9) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}
