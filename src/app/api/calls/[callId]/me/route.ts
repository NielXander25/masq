import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/api";

// A guest polls this while waiting in the lobby. Returns only their own status.
export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const { callId } = await params;

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { status: true, call: { select: { status: true } } },
  });
  if (!participant) return jsonError(404, "Not found");

  return NextResponse.json(
    { status: participant.status, callStatus: participant.call.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
