import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { AccountMenu, JoinWithLink, LocalTime, ShareLinkButton } from "@/components/dashboard-bits";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";
import { NewCallButton } from "@/components/new-call-form";
import { ArrowInIcon, ArrowOutIcon, PlayIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { inviteUrl } from "@/lib/invite";
import { canUse } from "@/lib/plans";
import { recordingConfigured } from "@/lib/recording";
import { requireUser } from "@/lib/session";

type Row = {
  key: string;
  when: Date;
  kind: "hosted" | "joined";
  callId: string;
  alias: string;
  title: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  waiting: number;
  guests: number;
  recorded: boolean;
  canRejoin: boolean;
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const [hosted, joined] = await Promise.all([
    db.call.findMany({
      where: { hostId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        hostAlias: true,
        hostTitle: true,
        status: true,
        createdAt: true,
        recordingEnabled: true,
        _count: {
          select: {
            participants: { where: { isHost: false, joinedAt: { not: null } } },
          },
        },
        participants: { where: { status: "PENDING" }, select: { id: true } },
      },
    }),
    // Calls joined as a guest: only the alias is shown, never the host's account.
    db.participant.findMany({
      where: { userId: user.id, isHost: false, joinedAt: { not: null } },
      orderBy: { joinedAt: "desc" },
      take: 40,
      select: {
        status: true,
        joinedAt: true,
        call: { select: { id: true, hostAlias: true, hostTitle: true, status: true } },
      },
    }),
  ]);

  const rows: Row[] = [
    ...hosted.map((c) => ({
      key: `h-${c.id}`,
      when: c.createdAt,
      kind: "hosted" as const,
      callId: c.id,
      alias: c.hostAlias,
      title: c.hostTitle,
      status: c.status,
      waiting: c.status === "ENDED" ? 0 : c.participants.length,
      guests: c._count.participants,
      recorded: c.recordingEnabled,
      canRejoin: false,
    })),
    ...joined.map((p) => ({
      key: `j-${p.call.id}`,
      when: p.joinedAt!,
      kind: "joined" as const,
      callId: p.call.id,
      alias: p.call.hostAlias,
      title: p.call.hostTitle,
      status: p.call.status,
      waiting: 0,
      guests: 0,
      recorded: false,
      canRejoin: p.call.status !== "ENDED" && (p.status === "LEFT" || p.status === "ADMITTED"),
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  const isAdmin = user.role === "ADMIN";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <Logo className="text-xl" />
        {isAdmin && <ModeSwitch current="personal" />}
        <AccountMenu
          name={user.name ?? user.email ?? "You"}
          email={user.email ?? ""}
          image={user.image ?? null}
          planLabel={isAdmin ? "Admin (all features)" : `${user.plan} plan`}
          signOut={<SignOutButton />}
        />
      </header>

      <div className="mt-6 flex gap-2">
        <NewCallButton canUseVoiceChanger={canUse("VOICE_CHANGER", user)} canRecord={recordingConfigured()} />
        <JoinWithLink />
      </div>

      <h2 className="mb-1 mt-8 px-1 text-sm font-medium text-neutral-400">Recent</h2>
      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-neutral-800 p-8 text-center">
          <p className="font-medium">No calls yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Tap <span className="text-white">New call link</span> to get a link you can share right away.
          </p>
        </div>
      ) : (
        <ul>
          {rows.map((r) => {
            const active = r.status !== "ENDED";
            const href =
              r.kind === "hosted"
                ? active
                  ? `/call/${r.callId}`
                  : r.recorded
                    ? `/dashboard/calls/${r.callId}`
                    : undefined
                : r.canRejoin
                  ? `/call/${r.callId}`
                  : undefined;
            const subtitle =
              r.kind === "hosted"
                ? r.status === "SCHEDULED"
                  ? "Not started"
                  : r.status === "LIVE"
                    ? "Live now"
                    : `${r.guests} guest${r.guests === 1 ? "" : "s"}`
                : r.canRejoin
                  ? "Still on · rejoin"
                  : "Joined";
            const inner = (
              <>
                <span className="relative">
                  <Avatar name={r.alias} />
                  {r.status === "LIVE" && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0b0f] bg-green-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.alias}</span>
                    {r.title && <span className="truncate text-sm text-neutral-500">{r.title}</span>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-neutral-400">
                    {r.kind === "hosted" ? (
                      <ArrowOutIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowInIcon className="h-4 w-4 text-sky-400" />
                    )}
                    <span className="truncate">
                      <LocalTime iso={r.when.toISOString()} /> · {subtitle}
                    </span>
                  </span>
                  {r.waiting > 0 && (
                    <span className="mt-1 inline-block rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-black">
                      {r.waiting} waiting to join
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li key={r.key} className="flex items-center gap-1 border-b border-neutral-900">
                {href ? (
                  <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-1">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-1">{inner}</div>
                )}
                {r.kind === "hosted" && active && (
                  <ShareLinkButton url={inviteUrl({ id: r.callId, hostAlias: r.alias })} alias={r.alias} />
                )}
                {r.kind === "hosted" && !active && r.recorded && (
                  <Link
                    href={`/dashboard/calls/${r.callId}`}
                    aria-label="Recording"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800"
                  >
                    <PlayIcon className="h-5 w-5" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
