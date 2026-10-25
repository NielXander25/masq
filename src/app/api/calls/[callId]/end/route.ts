import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/api";
import { findHostedCall } from "@/lib/calls";
import { deleteRoom } from "@/lib/livekit";

// Host only: end the call for everyone.
export async function POST(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const { callId } = await params;
  const call = await findHostedCall(callId, user.id);
  if (!call) return jsonError(404, "Not found");
  if (call.status === "ENDED") return NextResponse.json({ status: "ENDED" });

  const now = new Date();
  await db.$transaction([
    db.call.update({ where: { id: callId }, data: { status: "ENDED", endedAt: now } }),
    db.participant.updateMany({
      where: { callId, status: "ADMITTED", joinedAt: { not: null }, leftAt: null },
      data: { leftAt: now },
    }),
    db.participant.updateMany({
      where: { callId, isHost: false, status: "ADMITTED" },
      data: { status: "LEFT" },
    }),
    db.participant.updateMany({
      where: { callId, status: "PENDING" },
      data: { status: "DENIED" },
    }),
  ]);

  // Closing the room disconnects everyone still connected.
  await deleteRoom(call.roomName);
  return NextResponse.json({ status: "ENDED" });
}
