"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { randomId } from "@/lib/ids";
import { requireUser } from "@/lib/session";

const requestJoinSchema = z.object({
  callId: z.string().min(1).max(64),
  consent: z.literal(true, { error: "You must agree before joining" }),
});

export type RequestJoinResult = { ok: true } | { ok: false; error: string };

export async function requestJoin(input: unknown): Promise<RequestJoinResult> {
  const parsed = requestJoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const { callId } = parsed.data;

  const user = await requireUser(`/c/${callId}`);
  const call = await db.call.findUnique({
    where: { id: callId },
    select: { hostId: true, status: true },
  });
  if (!call) return { ok: false, error: "Call not found" };
  if (call.status === "ENDED") return { ok: false, error: "This call has ended" };
  if (call.hostId === user.id) return { ok: false, error: "You are the host of this call" };

  const existing = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { id: true, status: true },
  });

  if (!existing) {
    await db.participant.create({
      data: {
        callId,
        userId: user.id,
        livekitIdentity: randomId("guest"),
        status: "PENDING",
        consentedAt: new Date(),
      },
    });
  } else if (existing.status === "DENIED") {
    return { ok: false, error: "The host declined your request" };
  } else if (existing.status === "LEFT") {
    await db.participant.update({
      where: { id: existing.id },
      data: { status: "PENDING", consentedAt: new Date(), leftAt: null },
    });
  }
  return { ok: true };
}
