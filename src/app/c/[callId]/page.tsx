import { notFound, redirect } from "next/navigation";
import { JoinRequest } from "@/components/join-request";
import { db } from "@/lib/db";
import { callIdFromInvite } from "@/lib/invite";
import { requireUser } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId: segment } = await params;
  const user = await requireUser(`/c/${segment}`);
  const callId = callIdFromInvite(segment);

  // Select only what a guest may see: never the host's account.
  const call = await db.call.findUnique({
    where: { id: callId },
    select: {
      hostId: true,
      hostAlias: true,
      hostTitle: true,
      status: true,
      recordingEnabled: true,
      guestCamera: true,
    },
  });
  if (!call) notFound();
  if (call.hostId === user.id) redirect(`/call/${callId}`);

  const me = await db.participant.findUnique({
    where: { callId_userId: { callId, userId: user.id } },
    select: { status: true },
  });
  if (me?.status === "ADMITTED" && call.status !== "ENDED") redirect(`/call/${callId}`);

  const initialStatus = call.status === "ENDED" ? "ENDED" : (me?.status ?? "NONE");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-sm text-neutral-400">You&apos;re invited to a call with</p>
        <h1 className="mt-1 text-3xl font-semibold">{call.hostAlias}</h1>
        {call.hostTitle && <p className="mt-1 text-neutral-300">{call.hostTitle}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {call.recordingEnabled && (
            <span className="rounded bg-red-950 px-2 py-0.5 text-xs text-red-300">
              This call will be recorded
            </span>
          )}
          {call.guestCamera === "REQUIRED" && (
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
              Camera required
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-neutral-400">
        Joining as <span className="text-white">{user.name}</span> ({user.email})
      </p>
      <JoinRequest callId={callId} alias={call.hostAlias} initialStatus={initialStatus} />
    </main>
  );
}
