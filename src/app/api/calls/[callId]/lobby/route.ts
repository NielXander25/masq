import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/api";
import { findHostedCall } from "@/lib/calls";
import { maxParticipants } from "@/lib/plans";

// Host only: guests waiting to be admitted, plus who's already in.
export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const { callId } = await params;
  const call = await findHostedCall(callId, user.id);
  if (!call) return jsonError(404, "Not found");

  const guests = await db.participant.findMany({
    where: { callId, isHost: false, status: { in: ["PENDING", "ADMITTED"] } },
    orderBy: { consentedAt: "asc" },
    select: {
      id: true,
      status: true,
      consentedAt: true,
      user: { select: { name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(
    {
      callStatus: call.status,
      maxParticipants: maxParticipants(call.host),
      guests: guests.map((g) => ({
        id: g.id,
        status: g.status,
        requestedAt: g.consentedAt,
        name: g.user.name,
        email: g.user.email,
        image: g.user.image,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
