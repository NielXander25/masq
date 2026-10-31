import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { allow, TOO_MANY } from "@/lib/rate-limit";

const scalar = z.union([z.string().max(300), z.number(), z.boolean(), z.null()]);
const bodySchema = z.object({
  callId: z.string().min(1).max(64),
  event: z.enum(["voice-health"]),
  data: z.record(z.string().max(40), scalar).refine((d) => Object.keys(d).length <= 20),
});

// Client diagnostics (audio-engine state only: no audio, no identity), written
// to the server logs to debug device-specific problems.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  if (!allow(`diag:${user.id}`, 30, 60_000)) return jsonError(429, TOO_MANY);
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, "Invalid request");
  console.log("[diag]", parsed.data.event, parsed.data.callId, JSON.stringify(parsed.data.data));
  return NextResponse.json({ ok: true });
}
