import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CallRoom } from "@/components/call-room";
import { env } from "@/env";
import { db } from "@/lib/db";
import { isVoicePreset } from "@/lib/voice/presets";
import { requireUser } from "@/lib/session";

export default async function CallPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const user = await requireUser(`/call/${callId}`);

  const participant = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: {
      isHost: true,
      status: true,
      call: {
        select: { hostAlias: true, status: true, voiceChangerEnabled: true, voicePreset: true },
      },
    },
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
        <Link href="/dashboard" className="text-sm text-neutral-400 underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  // Only the alias reaches the client: never the host's account. Voice settings
  // and the invite link go to the host only.
  if (!participant.isHost) {
    return <CallRoom callId={callId} isHost={false} alias={call.hostAlias} />;
  }
  const voicePreset =
    call.voiceChangerEnabled && isVoicePreset(call.voicePreset) ? call.voicePreset : null;
  return (
    <CallRoom
      callId={callId}
      isHost
      alias={call.hostAlias}
      inviteUrl={`${env.APP_URL}/c/${callId}`}
      voicePreset={voicePreset}
    />
  );
}
