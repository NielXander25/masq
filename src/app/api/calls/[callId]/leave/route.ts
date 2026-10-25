import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/api";

// Called when someone clicks Leave. Guests must ask again to rejoin; the host can come back.
export async function POST(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const { callId } = await params;

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { id: true, isHost: true, status: true },
  });
  if (!participant) return jsonError(404, "Not found");

  await db.participant.update({
    where: { id: participant.id },
    data: {
      leftAt: new Date(),
      ...(!participant.isHost && participant.status === "ADMITTED" ? { status: "LEFT" } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
