import { z } from "zod";

// Treat empty strings from .env files as "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Phase 1
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  APP_URL: z.url(),

  // Later phases. These become required once the feature that uses them lands.
  LIVEKIT_URL: optional(z.url()),
  LIVEKIT_API_KEY: optional(z.string()),
  LIVEKIT_API_SECRET: optional(z.string()),
  R2_ACCOUNT_ID: optional(z.string()),
  R2_ACCESS_KEY_ID: optional(z.string()),
  R2_SECRET_ACCESS_KEY: optional(z.string()),
  R2_BUCKET: optional(z.string()),
  DEEPGRAM_API_KEY: optional(z.string()),
  RESEND_API_KEY: optional(z.string()),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
