import { NextResponse } from "next/server";
import { hostDisplayName } from "@/lib/alias";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { createToken, livekitConfigured, livekitServerUrl } from "@/lib/livekit";

const bodySchema = z.object({ callId: z.string().min(1).max(64) });

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, "Invalid request");
  if (!livekitConfigured()) return jsonError(503, "Calls are not available yet");
  const { callId } = parsed.data;

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: {
      id: true,
      isHost: true,
      status: true,
      joinedAt: true,
      livekitIdentity: true,
      user: { select: { name: true, email: true } },
      call: {
        select: { id: true, roomName: true, status: true, hostAlias: true, hostTitle: true },
      },
    },
  });
  // Nobody gets a token unless they host the call or the host admitted them.
  if (!participant || participant.status !== "ADMITTED") return jsonError(403, "Not admitted");
  const { call } = participant;
  if (call.status === "ENDED") return jsonError(410, "This call has ended");

  const token = participant.isHost
    ? await createToken({
        kind: "host",
        roomName: call.roomName,
        identity: participant.livekitIdentity,
        alias: hostDisplayName(call.hostAlias, call.hostTitle),
      })
    : await createToken({
        kind: "guest",
        roomName: call.roomName,
        identity: participant.livekitIdentity,
        name: participant.user.name ?? participant.user.email,
        email: participant.user.email,
      });

  const now = new Date();
  await db.participant.update({
    where: { id: participant.id },
    data: { joinedAt: participant.joinedAt ?? now, leftAt: null },
  });
  if (participant.isHost && call.status === "SCHEDULED") {
    await db.call.updateMany({
      where: { id: call.id, status: "SCHEDULED" },
      data: { status: "LIVE", startedAt: now },
    });
  }

  return NextResponse.json(
    { token, serverUrl: livekitServerUrl() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
