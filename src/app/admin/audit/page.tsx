import Link from "next/link";
import { Empty } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

const TARGET_LINK: Record<string, (id: string) => string> = {
  Call: (id) => `/admin/calls/${id}`,
  Report: () => "/admin/reports",
};

export default async function AdminAudit() {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const actors = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
    select: { id: true, email: true },
  });
  const email = new Map(actors.map((a) => [a.id, a.email]));
  const users = await db.user.findMany({
    where: { id: { in: rows.filter((r) => r.targetType === "User").map((r) => r.targetId) } },
    select: { id: true, email: true },
  });
  const userEmail = new Map(users.map((u) => [u.id, u.email]));

  if (rows.length === 0) return <Empty>No admin actions yet.</Empty>;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-neutral-500">
          <tr className="border-b border-neutral-800">
            <th className="p-3">When</th>
            <th className="p-3">Admin</th>
            <th className="p-3">Action</th>
            <th className="p-3">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => {
            const link = TARGET_LINK[r.targetType]?.(r.targetId);
            const label =
              r.targetType === "User" ? (userEmail.get(r.targetId) ?? r.targetId) : `${r.targetType} ${r.targetId}`;
            return (
              <tr key={r.id}>
                <td className="whitespace-nowrap p-3 text-neutral-400">{fmtDateTime(r.createdAt)}</td>
                <td className="p-3">{email.get(r.actorId) ?? r.actorId}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 text-neutral-400">
                  {link ? (
                    <Link href={link} className="hover:underline">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
