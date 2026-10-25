import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CallRoom } from "@/components/call-room";
import { db } from "@/lib/db";
import { inviteUrl } from "@/lib/invite";
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
        select: {
          hostAlias: true,
          hostTitle: true,
          status: true,
          voiceChangerEnabled: true,
          voicePreset: true,
          guestCamera: true,
        },
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
    return (
      <CallRoom
        callId={callId}
        isHost={false}
        alias={call.hostAlias}
        title={call.hostTitle}
        cameraRequired={call.guestCamera === "REQUIRED"}
      />
    );
  }
  const voicePreset =
    call.voiceChangerEnabled && isVoicePreset(call.voicePreset) ? call.voicePreset : null;
  return (
    <CallRoom
      callId={callId}
      isHost
      alias={call.hostAlias}
      title={call.hostTitle}
      inviteUrl={inviteUrl({ id: callId, hostAlias: call.hostAlias })}
      voicePreset={voicePreset}
    />
  );
}
