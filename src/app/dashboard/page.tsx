import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { ShareButton } from "@/components/copy-button";
import { NewCallForm } from "@/components/new-call-form";
import { db } from "@/lib/db";
import { env } from "@/env";
import { canUse } from "@/lib/plans";
import { requireUser } from "@/lib/session";

const STATUS_STYLE = {
  SCHEDULED: "bg-neutral-800 text-neutral-300",
  LIVE: "bg-green-900 text-green-300",
  ENDED: "bg-neutral-900 text-neutral-500",
} as const;

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const calls = await db.call.findMany({
    where: { hostId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      hostAlias: true,
      status: true,
      createdAt: true,
      recordingEnabled: true,
      _count: { select: { participants: { where: { isHost: false, joinedAt: { not: null } } } } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {user.role === "ADMIN" && (
            <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <p className="mt-2 text-sm text-neutral-400">
        Signed in as <span className="text-white">{user.email}</span> · {user.plan} plan
      </p>

      <div className="mt-8">
        <NewCallForm canUseVoiceChanger={canUse("VOICE_CHANGER", user)} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Your calls</h2>
        {calls.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
            No calls yet. Create one above, then share the invite link.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.hostAlias}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {c.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    {" · "}
                    {c._count.participants} guest{c._count.participants === 1 ? "" : "s"}
                    {c.recordingEnabled && " · recorded"}
                  </div>
                </div>
                {c.status !== "ENDED" && (
                  <div className="flex gap-2">
                    <ShareButton url={`${env.APP_URL}/c/${c.id}`} />
                    <Link
                      href={`/call/${c.id}`}
                      className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
                    >
                      Open
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
