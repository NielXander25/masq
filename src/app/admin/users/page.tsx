import { z } from "zod";
import { UserActions } from "@/components/admin-controls";
import { Badge, Empty } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDate, timeAgo } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

const PAGE = 50;
const search = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin();
  const { q, page } = search.parse(await searchParams);
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        plan: true,
        bannedAt: true,
        createdAt: true,
        lastSeenAt: true,
        _count: {
          select: { hostedCalls: true, participations: { where: { isHost: false, joinedAt: { not: null } } } },
        },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Search</button>
      </form>
      <p className="text-xs text-neutral-500">
        {total} user{total === 1 ? "" : "s"}
        {q && ` matching "${q}"`}
      </p>

      {users.length === 0 ? (
        <Empty>No users found.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" className="h-9 w-9 shrink-0 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-700" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{u.name ?? "—"}</span>
                    {u.role === "ADMIN" && <Badge>ADMIN</Badge>}
                    <Badge>{u.plan}</Badge>
                    {u.bannedAt && <Badge>BANNED</Badge>}
                  </div>
                  <div className="truncate text-sm text-neutral-400">{u.email}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    Joined {fmtDate(u.createdAt)} · seen {timeAgo(u.lastSeenAt)} · hosted {u._count.hostedCalls} ·
                    joined {u._count.participations}
                  </div>
                </div>
              </div>
              <UserActions userId={u.id} plan={u.plan} banned={Boolean(u.bannedAt)} isSelf={u.id === me.id} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <a href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-neutral-400 hover:text-white">
              ← Previous
            </a>
          ) : (
            <span />
          )}
          <span className="text-neutral-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <a href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-neutral-400 hover:text-white">
              Next →
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
