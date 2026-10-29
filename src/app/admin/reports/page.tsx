import Link from "next/link";
import { setReportStatus } from "@/app/admin/actions";
import { Badge, Empty } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

const STATUSES = ["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"] as const;

export default async function AdminReports() {
  const reports = await db.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      reporter: { select: { name: true, email: true } },
      call: { select: { id: true, hostAlias: true } },
    },
  });

  if (reports.length === 0) return <Empty>No reports yet.</Empty>;

  return (
    <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
      {reports.map((r) => (
        <li key={r.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge>{r.status}</Badge>
            <Link href={`/admin/calls/${r.call.id}`} className="font-medium hover:underline">
              {r.call.hostAlias}
            </Link>
            <span className="text-neutral-500">
              reported by {r.reporter.email} · {fmtDateTime(r.createdAt)}
            </span>
          </div>
          <p className="text-sm">{r.reason}</p>
          <form action={setReportStatus} className="flex items-center gap-2">
            <input type="hidden" name="reportId" value={r.id} />
            <select
              name="status"
              defaultValue={r.status}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/10"
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/10 hover:bg-white/15">
              Update
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
