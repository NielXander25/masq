import { z } from "zod";
import { UserActions } from "@/components/admin-controls";
import { Badge, Empty } from "@/components/admin-ui";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/primitives";
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

  const [all, week, total, users] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
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
      <div className="glass rounded-[28px] p-6">
        <div className="text-sm font-medium text-neutral-400">Total users</div>
        <div className="mt-1 text-7xl font-semibold tabular-nums tracking-tight">{all.toLocaleString()}</div>
        <div className="mt-2 text-sm text-neutral-400">+{week} this week</div>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="ios-field min-w-0 flex-1 !rounded-full !py-2.5 !text-sm"
        />
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Search</button>
      </form>
      {q && (
        <p className="px-1 text-xs text-neutral-500">
          {total} matching &ldquo;{q}&rdquo;
        </p>
      )}

      {users.length === 0 ? (
        <Empty>No users found.</Empty>
      ) : (
        <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          {users.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                  <Avatar name={u.name ?? u.email} image={u.image} />
                  <span className="min-w-0 flex-1 truncate font-medium">{u.name ?? u.email}</span>
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-neutral-500 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 px-4 pb-4 pl-[4.25rem]">
                  <div className="break-all text-sm text-neutral-300">{u.email}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.role === "ADMIN" && <Badge>ADMIN</Badge>}
                    <Badge>{u.plan}</Badge>
                    {u.bannedAt && <Badge>BANNED</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-neutral-500">Joined</dt>
                    <dd>{fmtDate(u.createdAt)}</dd>
                    <dt className="text-neutral-500">Last seen</dt>
                    <dd>{timeAgo(u.lastSeenAt)}</dd>
                    <dt className="text-neutral-500">Calls hosted</dt>
                    <dd className="tabular-nums">{u._count.hostedCalls}</dd>
                    <dt className="text-neutral-500">Calls joined</dt>
                    <dd className="tabular-nums">{u._count.participations}</dd>
                  </dl>
                  <UserActions userId={u.id} plan={u.plan} banned={Boolean(u.bannedAt)} isSelf={u.id === me.id} />
                </div>
              </details>
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
