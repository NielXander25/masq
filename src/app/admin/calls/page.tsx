import Link from "next/link";
import { z } from "zod";
import { Badge, Empty } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { callDurationSec, fmtDateTime, fmtDuration } from "@/lib/format";

const search = z.object({
  status: z.enum(["LIVE", "SCHEDULED", "ENDED"]).optional().catch(undefined),
});

export default async function AdminCalls({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status } = search.parse(await searchParams);
  const calls = await db.call.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      hostAlias: true,
      status: true,
      createdAt: true,
      startedAt: true,
      endedAt: true,
      recordingEnabled: true,
      voiceChangerEnabled: true,
      _count: {
        select: {
          participants: { where: { joinedAt: { not: null } } },
          recordings: true,
          reports: { where: { status: "OPEN" } },
        },
      },
    },
  });

  const filters = [undefined, "LIVE", "SCHEDULED", "ENDED"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `/admin/calls?status=${f}` : "/admin/calls"}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              status === f ? "bg-white text-black" : "bg-white/10 text-neutral-300"
            }`}
          >
            {f ?? "All"}
          </Link>
        ))}
      </div>
      {calls.length === 0 ? (
        <Empty>No calls.</Empty>
      ) : (
        <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          {calls.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/calls/${c.id}`} className="block space-y-1 p-4 hover:bg-white/[0.04]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.hostAlias}</span>
                  <Badge>{c.status}</Badge>
                  {c._count.reports > 0 && (
                    <span className="rounded bg-red-900 px-1.5 text-xs text-red-200">reported</span>
                  )}
                </div>
                <div className="text-sm text-neutral-400">
                  {c._count.participants} {c._count.participants === 1 ? "person" : "people"} ·{" "}
                  {fmtDuration(callDurationSec(c))}
                  {c.voiceChangerEnabled && " · voice disguised"}
                  {c.recordingEnabled &&
                    ` · recorded${c._count.recordings ? ` (${c._count.recordings} files)` : ""}`}
                </div>
                <div className="text-xs text-neutral-500">{fmtDateTime(c.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
