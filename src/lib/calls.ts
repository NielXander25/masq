import { db } from "@/lib/db";

/** The call if `userId` hosts it, otherwise null. */
export function findHostedCall(callId: string, userId: string) {
  return db.call.findFirst({
    where: { id: callId, hostId: userId },
    select: {
      id: true,
      roomName: true,
      status: true,
      host: { select: { plan: true, role: true } },
    },
  });
}
