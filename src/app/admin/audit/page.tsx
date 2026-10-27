import Link from "next/link";
import { Empty } from "@/components/admin-ui";
import type { AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

const ACTION: Record<AuditAction, { label: string; tone: string }> = {
  VIEW_HOST_IDENTITY: { label: "Revealed a host", tone: "bg-amber-500/15 text-amber-300" },
  VIEW_RECORDING: { label: "Opened a recording", tone: "bg-sky-500/15 text-sky-300" },
  VIEW_TRANSCRIPT: { label: "Opened a transcript", tone: "bg-sky-500/15 text-sky-300" },
  BAN_USER: { label: "Banned a user", tone: "bg-red-500/15 text-red-300" },
  UNBAN_USER: { label: "Unbanned a user", tone: "bg-green-500/15 text-green-300" },
  CHANGE_PLAN: { label: "Changed a plan", tone: "bg-purple-500/15 text-purple-300" },
  UPDATE_REPORT: { label: "Updated a report", tone: "bg-neutral-500/15 text-neutral-300" },
};

export default async function AdminAudit() {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const ids = (type: string) => [...new Set(rows.filter((r) => r.targetType === type).map((r) => r.targetId))];
  const [people, calls] = await Promise.all([
    db.user.findMany({
      where: { id: { in: [...new Set([...rows.map((r) => r.actorId), ...ids("User")])] } },
      select: { id: true, email: true },
    }),
    db.call.findMany({ where: { id: { in: ids("Call") } }, select: { id: true, hostAlias: true } }),
  ]);
  const email = new Map(people.map((u) => [u.id, u.email]));
  const alias = new Map(calls.map((c) => [c.id, c.hostAlias]));

  if (rows.length === 0) return <Empty>No admin actions yet.</Empty>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Every time an admin reveals a host, opens a recording or transcript, bans someone or changes a plan. Read-only.
      </p>
      <ul className="divide-y divide-neutral-800 rounded-2xl border border-neutral-800">
        {rows.map((r) => {
          const action = ACTION[r.action as AuditAction] ?? { label: r.action, tone: "bg-neutral-800 text-neutral-300" };
          const target =
            r.targetType === "User" ? (
              <span>{email.get(r.targetId) ?? "Deleted user"}</span>
            ) : r.targetType === "Call" ? (
              <Link href={`/admin/calls/${r.targetId}`} className="underline-offset-2 hover:underline">
                Call “{alias.get(r.targetId) ?? r.targetId}”
              </Link>
            ) : r.targetType === "Report" ? (
              <Link href="/admin/reports" className="underline-offset-2 hover:underline">
                A report
              </Link>
            ) : (
              <span>
                {r.targetType} {r.targetId}
              </span>
            );
          return (
            <li key={r.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${action.tone}`}>{action.label}</span>
                <span className="min-w-0 truncate text-sm">{target}</span>
              </div>
              <div className="text-xs text-neutral-500">
                {email.get(r.actorId) ?? r.actorId} · {fmtDateTime(r.createdAt)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
