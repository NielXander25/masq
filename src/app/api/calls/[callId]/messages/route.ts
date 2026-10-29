import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { CHAT_MAX_LENGTH, CHAT_TOPIC, type ChatMessage } from "@/lib/chat";
import { broadcast } from "@/lib/livekit";

const bodySchema = z.object({ text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) });

type Sender = { isHost: boolean; livekitIdentity: string; user: { name: string | null } };

/**
 * What everyone in the call sees for a message. The host is shown by alias
 * only; their account is never included.
 */
function toWire(
  m: { id: string; text: string; createdAt: Date; participant: Sender },
  call: { hostAlias: string },
): ChatMessage {
  return {
    id: m.id,
    text: m.text,
    at: m.createdAt.toISOString(),
    from: m.participant.isHost ? call.hostAlias : (m.participant.user.name ?? "Guest"),
    isHost: m.participant.isHost,
    identity: m.participant.livekitIdentity,
  };
}

/** Only the host and admitted guests of a live call can read or send. */
async function member(callId: string) {
  const user = await apiUser();
  if (!user) return { error: jsonError(401, "Unauthorized") } as const;
  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: {
      id: true,
      isHost: true,
      status: true,
      call: { select: { id: true, status: true, roomName: true, hostAlias: true } },
    },
  });
  if (!participant || (!participant.isHost && participant.status !== "ADMITTED")) {
    return { error: jsonError(403, "Not in this call") } as const;
  }
  if (participant.call.status === "ENDED") return { error: jsonError(410, "This call has ended") } as const;
  return { participant } as const;
}

const sender = { select: { isHost: true, livekitIdentity: true, user: { select: { name: true } } } };

export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const m = await member(callId);
  if ("error" in m) return m.error;
  const messages = await db.callMessage.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, text: true, createdAt: true, participant: sender },
  });
  return NextResponse.json(
    { messages: messages.map((x) => toWire(x, m.participant.call)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const m = await member(callId);
  if ("error" in m) return m.error;
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, `Messages can be 1 to ${CHAT_MAX_LENGTH} characters`);

  // At most 5 messages per 10 seconds per person.
  const recent = await db.callMessage.count({
    where: { participantId: m.participant.id, createdAt: { gte: new Date(Date.now() - 10_000) } },
  });
  if (recent >= 5) return jsonError(429, "You're sending messages too fast");

  const created = await db.callMessage.create({
    data: { callId, participantId: m.participant.id, text: parsed.data.text },
    select: { id: true, text: true, createdAt: true, participant: sender },
  });
  const message = toWire(created, m.participant.call);
  try {
    await broadcast(m.participant.call.roomName, CHAT_TOPIC, message);
  } catch {
    // Stored anyway; others will get it when they next load the chat.
  }
  return NextResponse.json({ message });
}
