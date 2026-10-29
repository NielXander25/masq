export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="glass rounded-[22px] p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

/** Simple daily bar chart. `data` is oldest to newest. */
export function DailyBars({ title, data }: { title: string; data: { day: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((a, d) => a + d.n, 0);
  return (
    <section className="glass rounded-[22px] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-neutral-500">{total} in {data.length} days</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={`${title}: ${total} total`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t bg-neutral-300 group-hover:bg-white"
              style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 3 : 1, opacity: d.n ? 1 : 0.25 }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-1.5 py-0.5 text-xs group-hover:block">
              {d.day}: {d.n}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        <span>{data[0]?.day}</span>
        <span>{data.at(-1)?.day}</span>
      </div>
    </section>
  );
}

const BADGE: Record<string, string> = {
  LIVE: "bg-green-900 text-green-300",
  SCHEDULED: "bg-neutral-800 text-neutral-300",
  ENDED: "bg-neutral-900 text-neutral-500",
  PRO: "bg-violet-900 text-violet-200",
  FREE: "bg-neutral-800 text-neutral-300",
  ADMIN: "bg-amber-500 text-black",
  BANNED: "bg-red-900 text-red-200",
  OPEN: "bg-red-900 text-red-200",
  REVIEWED: "bg-neutral-800 text-neutral-300",
  ACTIONED: "bg-green-900 text-green-300",
  DISMISSED: "bg-neutral-900 text-neutral-500",
  PENDING: "bg-amber-900 text-amber-200",
  ADMITTED: "bg-green-900 text-green-300",
  DENIED: "bg-red-900 text-red-200",
  LEFT: "bg-neutral-800 text-neutral-400",
};

export function Badge({ children }: { children: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[children] ?? "bg-neutral-800"}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="glass rounded-[22px] p-6 text-center text-sm text-neutral-500">
      {children}
    </p>
  );
}
