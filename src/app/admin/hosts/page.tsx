import Link from "next/link";
import { RevealHost } from "@/components/admin-controls";
import { Badge, Empty } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export default async function AdminHosts() {
  const calls = await db.call.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, hostAlias: true, hostTitle: true, status: true, createdAt: true },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Every call and the alias its host used. Revealing the real account is recorded in the audit log.
      </p>
      {calls.length === 0 ? (
        <Empty>No calls yet.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {calls.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/calls/${c.id}`} className="font-medium hover:underline">
                    {c.hostAlias}
                  </Link>
                  {c.hostTitle && <span className="text-sm text-neutral-400">{c.hostTitle}</span>}
                  <Badge>{c.status}</Badge>
                </div>
                <div className="text-xs text-neutral-500">{fmtDateTime(c.createdAt)}</div>
              </div>
              <RevealHost callId={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
