import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { findHostedCall } from "@/lib/calls";
import { maxParticipants } from "@/lib/plans";

const bodySchema = z.object({ action: z.enum(["admit", "deny"]) });

class LimitReached extends Error {}

// Host only: admit or deny a pending guest.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string; participantId: string }> },
) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, "Invalid request");
  const { callId, participantId } = await params;

  const call = await findHostedCall(callId, user.id);
  if (!call) return jsonError(404, "Not found");
  if (call.status === "ENDED") return jsonError(409, "This call has ended");

  const participant = await db.participant.findFirst({
    where: { id: participantId, callId, isHost: false },
    select: { id: true, status: true },
  });
  if (!participant) return jsonError(404, "Not found");
  if (participant.status !== "PENDING") return jsonError(409, "This guest is no longer waiting");

  if (parsed.data.action === "deny") {
    await db.participant.update({ where: { id: participant.id }, data: { status: "DENIED" } });
    return NextResponse.json({ status: "DENIED" });
  }

  const limit = maxParticipants(call.host);
  try {
    await db.$transaction(
      async (tx) => {
        if (limit !== null) {
          const inCall = await tx.participant.count({ where: { callId, status: "ADMITTED" } });
          if (inCall >= limit) throw new LimitReached();
        }
        await tx.participant.update({ where: { id: participant.id }, data: { status: "ADMITTED" } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof LimitReached) {
      return jsonError(
        409,
        `Your plan allows ${limit} people per call, including you. Upgrade to PRO for more.`,
      );
    }
    throw e;
  }
  return NextResponse.json({ status: "ADMITTED" });
}
