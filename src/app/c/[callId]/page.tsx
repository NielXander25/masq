import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { LogoMark } from "@/components/logo";
import { JoinRequest } from "@/components/join-request";
import { db } from "@/lib/db";
import { callIdFromInvite } from "@/lib/invite";
import { requireUser } from "@/lib/session";

type Params = { params: Promise<{ callId: string }> };

// Link previews show who's inviting (the alias only, never the host's account).
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { callId: segment } = await params;
  const call = await db.call.findUnique({
    where: { id: callIdFromInvite(segment) },
    select: { hostAlias: true, hostTitle: true, status: true },
  });
  if (!call || call.status === "ENDED") return { title: "Call invite" };
  const who = call.hostTitle ? `${call.hostAlias} (${call.hostTitle})` : call.hostAlias;
  const title = `${who} invited you to a call`;
  const description = "Join on masqq. Sign in with Google to request to join.";
  // Setting openGraph here replaces the root one, so the image must be repeated.
  const images = [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "masqq" }];
  return {
    title,
    description,
    openGraph: { title, description, images, siteName: "masqq", type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function InvitePage({ params }: Params) {
  const { callId: segment } = await params;
  const callId = callIdFromInvite(segment);

  // Signed-out visitors (and link-preview bots) see who's inviting and a sign-in button.
  const session = await auth();
  if (!session?.user) {
    const call = await db.call.findUnique({
      where: { id: callId },
      select: { hostAlias: true, hostTitle: true, status: true },
    });
    if (!call) notFound();
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
        <LogoMark className="h-12 w-12" />
        <div>
          <p className="text-sm text-neutral-400">You&apos;re invited to a call with</p>
          <h1 className="mt-1 text-3xl font-semibold">{call.hostAlias}</h1>
          {call.hostTitle && <p className="mt-1 text-neutral-300">{call.hostTitle}</p>}
        </div>
        {call.status === "ENDED" ? (
          <p className="rounded-xl border border-neutral-800 p-5 text-neutral-300">This call has ended.</p>
        ) : (
          <>
            <p className="text-sm text-neutral-400">Sign in with Google to request to join.</p>
            <GoogleSignInButton redirectTo={`/c/${segment}`} />
          </>
        )}
      </main>
    );
  }

  const user = await requireUser(`/c/${segment}`);

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
