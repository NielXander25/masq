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
      <div className="flex gap-2">
        {filters.map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `/admin/calls?status=${f}` : "/admin/calls"}
            className={`rounded-lg px-3 py-1 text-sm ${
              status === f ? "bg-neutral-200 text-black" : "border border-neutral-800 text-neutral-400"
            }`}
          >
            {f ?? "All"}
          </Link>
        ))}
      </div>
      {calls.length === 0 ? (
        <Empty>No calls.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-800">
                <th className="p-3">Alias</th>
                <th className="p-3">Status</th>
                <th className="p-3">People</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Recorded</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-950">
                  <td className="p-3">
                    <Link href={`/admin/calls/${c.id}`} className="font-medium hover:underline">
                      {c.hostAlias}
                    </Link>
                    {c.voiceChangerEnabled && <span className="ml-2 text-xs text-neutral-500">voice</span>}
                    {c._count.reports > 0 && (
                      <span className="ml-2 rounded bg-red-900 px-1 text-xs text-red-200">reported</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge>{c.status}</Badge>
                  </td>
                  <td className="p-3 tabular-nums">{c._count.participants}</td>
                  <td className="p-3 tabular-nums">{fmtDuration(callDurationSec(c))}</td>
                  <td className="p-3">
                    {c.recordingEnabled ? `Yes${c._count.recordings ? ` (${c._count.recordings} files)` : ""}` : "No"}
                  </td>
                  <td className="p-3 text-neutral-400">{fmtDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
