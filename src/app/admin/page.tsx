import Link from "next/link";
import { Badge, DailyBars, Stat } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDuration, timeAgo } from "@/lib/format";

const DAYS = 14;

/** Fill a daily series (UTC days) so days with no activity show as zero. */
function daily(rows: { d: Date; n: number }[]) {
  const byDay = new Map(rows.map((r) => [r.d.toISOString().slice(0, 10), r.n]));
  const out: { day: string; n: number }[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key.slice(5), n: byDay.get(key) ?? 0 });
  }
  return out;
}

export default async function AdminOverview() {
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 86400_000);

  const [
    users,
    users7,
    users30,
    active7,
    pro,
    banned,
    calls,
    live,
    calls7,
    voiceCalls,
    recordedCalls,
    guestJoins,
    denied,
    pending,
    recorded,
    openReports,
    talk,
    callsDaily,
    signupsDaily,
    recent,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: ago(7) } } }),
    db.user.count({ where: { createdAt: { gte: ago(30) } } }),
    db.user.count({ where: { lastSeenAt: { gte: ago(7) } } }),
    db.user.count({ where: { plan: "PRO" } }),
    db.user.count({ where: { bannedAt: { not: null } } }),
    db.call.count(),
    db.call.count({ where: { status: "LIVE" } }),
    db.call.count({ where: { createdAt: { gte: ago(7) } } }),
    db.call.count({ where: { voiceChangerEnabled: true } }),
    db.call.count({ where: { recordingEnabled: true } }),
    db.participant.count({ where: { isHost: false, joinedAt: { not: null } } }),
    db.participant.count({ where: { isHost: false, status: "DENIED" } }),
    db.participant.count({ where: { status: "PENDING", call: { status: { not: "ENDED" } } } }),
    db.recording.aggregate({ _sum: { durationSec: true }, where: { kind: "MIXED" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.$queryRaw<{ secs: number; n: number }[]>`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))), 0)::float AS secs,
             COUNT(*)::int AS n
      FROM "Call" WHERE "startedAt" IS NOT NULL AND "endedAt" IS NOT NULL`,
    db.$queryRaw<{ d: Date; n: number }[]>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(*)::int AS n FROM "Call"
      WHERE "createdAt" >= now() - make_interval(days => ${DAYS}::int) GROUP BY 1`,
    db.$queryRaw<{ d: Date; n: number }[]>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(*)::int AS n FROM "User"
      WHERE "createdAt" >= now() - make_interval(days => ${DAYS}::int) GROUP BY 1`,
    db.call.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        hostAlias: true,
        status: true,
        createdAt: true,
        _count: { select: { participants: { where: { isHost: false, joinedAt: { not: null } } } } },
      },
    }),
  ]);

  const talkSecs = talk[0]?.secs ?? 0;
  const endedCalls = talk[0]?.n ?? 0;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% of calls` : undefined);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Right now</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Live calls" value={live} />
          <Stat label="Guests waiting" value={pending} />
          <Stat label="Open reports" value={openReports} />
          <Stat label="Active users (7d)" value={active7} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Users</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total users" value={users} />
          <Stat label="New (7 days)" value={users7} sub={`${users30} in 30 days`} />
          <Stat label="PRO users" value={pro} sub={users ? `${Math.round((pro / users) * 100)}% of users` : undefined} />
          <Stat label="Banned" value={banned} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Usage</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total calls" value={calls} sub={`${calls7} in the last 7 days`} />
          <Stat label="Guest joins" value={guestJoins} sub={`${denied} requests denied`} />
          <Stat
            label="Talk time"
            value={fmtDuration(talkSecs)}
            sub={endedCalls ? `avg ${fmtDuration(talkSecs / endedCalls)} per call` : undefined}
          />
          <Stat label="Recorded minutes" value={Math.round((recorded._sum.durationSec ?? 0) / 60)} />
          <Stat label="Voice changer used" value={voiceCalls} sub={pct(voiceCalls, calls)} />
          <Stat label="Recording enabled" value={recordedCalls} sub={pct(recordedCalls, calls)} />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <DailyBars title="Calls per day" data={daily(callsDaily)} />
        <DailyBars title="Sign-ups per day" data={daily(signupsDaily)} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Latest calls</h2>
          <Link href="/admin/calls" className="text-xs text-neutral-400 hover:text-white">
            All calls →
          </Link>
        </div>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {recent.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/calls/${c.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-neutral-950">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.hostAlias}</span>
                  <Badge>{c.status}</Badge>
                </span>
                <span className="text-xs text-neutral-500">
                  {c._count.participants} guest{c._count.participants === 1 ? "" : "s"} · {timeAgo(c.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
