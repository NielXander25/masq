import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { AuthScreen } from "@/components/brand-hero";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/primitives";
import { JoinRequest } from "@/components/join-request";
import { db } from "@/lib/db";
import { hostDisplayName } from "@/lib/alias";
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
  const who = hostDisplayName(call.hostAlias, call.hostTitle);
  const title = `${who} invited you to a call`;
  const description = "A private masqq call. The host stays anonymous; tap to ask to join.";
  // Setting openGraph here replaces the root one, so the image must be repeated.
  // Bump ?v= whenever the image changes: WhatsApp caches previews by image URL.
  const images = [{ url: "/opengraph-image.png?v=2", width: 1200, height: 630, alt: "masqq" }];
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
      <AuthScreen>
        <Logo className="text-[17px]" />
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <Avatar name={call.hostAlias} size="h-28 w-28 text-4xl" />
          <p className="mt-5 text-[15px] text-neutral-400">You&apos;re invited to a call with</p>
          <HostHeading alias={call.hostAlias} purpose={call.hostTitle} />
          <span className="mt-4 rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-neutral-300 ring-1 ring-white/10">
            Anonymous host
          </span>
        </div>
        {call.status === "ENDED" ? (
          <p className="w-full rounded-3xl bg-neutral-900 p-5 text-center text-neutral-300">This call has ended.</p>
        ) : (
          <div className="w-full space-y-3 text-center">
            <GoogleSignInButton redirectTo={`/c/${segment}`} />
            <p className="px-4 text-[13px] leading-relaxed text-neutral-500">
              Sign in to ask to join. The host will see your Google name and email.
            </p>
          </div>
        )}
      </AuthScreen>
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
    <AuthScreen>
      <Logo className="text-[17px]" />
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <Avatar name={call.hostAlias} size="h-28 w-28 text-4xl" />
        <p className="mt-5 text-[15px] text-neutral-400">You&apos;re invited to a call with</p>
        <HostHeading alias={call.hostAlias} purpose={call.hostTitle} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-neutral-300 ring-1 ring-white/10">
            Anonymous host
          </span>
          {call.recordingEnabled && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-[13px] text-red-300 ring-1 ring-red-500/20">
              Will be recorded
            </span>
          )}
          {call.guestCamera === "REQUIRED" && (
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-neutral-300 ring-1 ring-white/10">
              Camera required
            </span>
          )}
        </div>
      </div>
      <div className="glass flex w-full items-center gap-3 rounded-[22px] px-4 py-3">
        <Avatar name={user.name ?? user.email ?? "You"} image={user.image} size="h-9 w-9 text-sm" />
        <div className="min-w-0 text-left text-sm">
          <div className="truncate font-medium">Joining as {user.name}</div>
          <div className="truncate text-neutral-400">{user.email}</div>
        </div>
      </div>
      <div className="mt-3 w-full">
        <JoinRequest callId={callId} alias={call.hostAlias} initialStatus={initialStatus} />
      </div>
    </AuthScreen>
  );
}

/** "Night Owl | Interviewer": the name, then the purpose of the call. */
function HostHeading({ alias, purpose }: { alias: string; purpose: string | null }) {
  return (
    <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">
      {alias}
      {purpose && <span className="font-medium text-neutral-400"> | {purpose}</span>}
    </h1>
  );
}
