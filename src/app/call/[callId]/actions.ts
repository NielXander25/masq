"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { maxParticipants } from "@/lib/plans";
import { requireUser } from "@/lib/session";

export type RejoinResult = { ok: true } | { ok: false; error: string };

class Full extends Error {}

/**
 * A guest the host already admitted can come back after leaving, without
 * asking again, as long as the call is still on and there's room.
 */
export async function rejoinCall(input: unknown): Promise<RejoinResult> {
  const { callId } = z.object({ callId: z.string().min(1).max(64) }).parse(input);
  const user = await requireUser(`/call/${callId}`);

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { id: true, isHost: true, status: true, call: { select: { status: true, host: { select: { plan: true } } } } },
  });
  if (!participant) return { ok: false, error: "You're not part of this call" };
  if (participant.call.status === "ENDED") return { ok: false, error: "This call has ended" };
  if (participant.isHost || participant.status === "ADMITTED") return { ok: true };
  if (participant.status !== "LEFT") return { ok: false, error: "You can't rejoin this call" };

  const limit = maxParticipants(participant.call.host);
  try {
    await db.$transaction(
      async (tx) => {
        if (limit !== null) {
          const inCall = await tx.participant.count({ where: { callId, status: "ADMITTED" } });
          if (inCall >= limit) throw new Full();
        }
        await tx.participant.update({ where: { id: participant.id }, data: { status: "ADMITTED", leftAt: null } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof Full) return { ok: false, error: "The call is full right now. Try again in a moment." };
    throw e;
  }
  return { ok: true };
}
