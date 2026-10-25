import { notFound, redirect } from "next/navigation";
import { CallRoom } from "@/components/call-room";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function CallPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const user = await requireUser(`/call/${callId}`);

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { isHost: true, status: true, call: { select: { hostAlias: true, status: true } } },
  });
  if (!participant) {
    const exists = await db.call.count({ where: { id: callId } });
    if (!exists) notFound();
    redirect(`/c/${callId}`);
  }
  const { call } = participant;
  if (!participant.isHost && participant.status !== "ADMITTED" && call.status !== "ENDED") {
    redirect(`/c/${callId}`);
  }

  if (call.status === "ENDED") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg">This call has ended.</p>
        <a href="/dashboard" className="text-sm text-neutral-400 underline">
          Back to dashboard
        </a>
      </main>
    );
  }

  // Only the alias reaches the client: never the host's account.
  return <CallRoom callId={callId} isHost={participant.isHost} alias={call.hostAlias} />;
}
