import { createHash, createHmac } from "node:crypto";
import { env } from "@/env";

// Minimal S3 (SigV4) presigning for Cloudflare R2. No SDK needed.

export function r2Configured() {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

export function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 is not configured");
  }
  return {
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

/** RFC 3986 encoding, as SigV4 requires. */
const rfc3986 = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

type PresignInput = {
  method: "GET" | "HEAD" | "PUT";
  host: string;
  /** Path starting with "/", e.g. "/bucket/calls/abc/file.ogg". Segments are encoded here. */
  path: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  expiresIn: number;
  query?: Record<string, string>;
  now?: Date;
};

/** Build a SigV4 query-string-signed URL (exported for tests). */
export function presign(i: PresignInput) {
  const now = i.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${i.region}/s3/aws4_request`;
  const params: Record<string, string> = {
    ...i.query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(i.expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join("&");
  const canonicalPath = i.path.split("/").map(rfc3986).join("/");
  const canonicalRequest = [
    i.method,
    canonicalPath,
    canonicalQuery,
    `host:${i.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${i.secretAccessKey}`, date);
  const kRegion = hmac(kDate, i.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return `https://${i.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Signed, expiring URL for an object in the recordings bucket. */
export function r2SignedUrl(
  key: string,
  opts: { expiresIn?: number; downloadName?: string; method?: "GET" | "HEAD" } = {},
) {
  const c = r2Config();
  return presign({
    method: opts.method ?? "GET",
    host: c.host,
    path: `/${c.bucket}/${key}`,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    region: "auto",
    expiresIn: opts.expiresIn ?? 3600,
    query: opts.downloadName
      ? { "response-content-disposition": `attachment; filename="${opts.downloadName.replace(/"/g, "")}"` }
      : undefined,
  });
}

/** Signed URL for the bucket itself (used by the admin health check). */
export function r2BucketUrl(method: "HEAD" | "GET" = "HEAD") {
  const c = r2Config();
  return presign({
    method,
    host: c.host,
    path: `/${c.bucket}`,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    region: "auto",
    expiresIn: 60,
  });
}
