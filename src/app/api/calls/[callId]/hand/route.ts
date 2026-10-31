import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { setHand } from "@/lib/livekit";
import { allow, TOO_MANY } from "@/lib/rate-limit";

const bodySchema = z.object({
  raised: z.boolean(),
  /** Host only: lower someone else's hand (by their call identity). */
  identity: z.string().min(1).max(64).optional(),
});

// Raise or lower your own hand; the host can also lower anyone's.
export async function POST(req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  if (!allow(`hand:${user.id}`, 10, 10_000)) return jsonError(429, TOO_MANY);
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, "Invalid request");
  const { callId } = await params;

  const me = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { isHost: true, status: true, livekitIdentity: true, call: { select: { status: true, roomName: true } } },
  });
  if (!me || (!me.isHost && me.status !== "ADMITTED")) return jsonError(403, "Not in this call");
  if (me.call.status !== "LIVE") return jsonError(409, "This call isn't live");

  let identity = me.livekitIdentity;
  if (parsed.data.identity && parsed.data.identity !== me.livekitIdentity) {
    if (!me.isHost || parsed.data.raised) return jsonError(403, "Only the host can lower someone's hand");
    const target = await db.participant.findFirst({
      where: { callId, livekitIdentity: parsed.data.identity },
      select: { livekitIdentity: true },
    });
    if (!target) return jsonError(404, "Not found");
    identity = target.livekitIdentity;
  }

  try {
    await setHand(me.call.roomName, identity, parsed.data.raised);
  } catch {
    return jsonError(409, "They're not connected right now");
  }
  return NextResponse.json({ raised: parsed.data.raised });
}
