import Link from "next/link";

/**
 * Full-screen status, iPhone style: a frosted glass square in the middle with
 * an icon and a short message, and a home button back to the dashboard.
 */
export function StatusCard({
  icon,
  title,
  subtitle,
  children,
  home = true,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  home?: boolean;
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-6">
      {/* Soft colour behind the glass so the frosting shows. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-[60%] rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-56 w-56 -translate-x-[10%] -translate-y-[10%] rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="glass sheet-panel flex aspect-square w-full max-w-[300px] flex-col items-center justify-center gap-3 rounded-[44px] p-7 text-center">
        {icon}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <div className="text-[15px] text-neutral-400">{subtitle}</div>}
        {children}
        {home && (
          <Link
            href="/dashboard"
            aria-label="Home"
            title="Home"
            className="mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-[26px] ring-1 ring-white/15 transition hover:bg-white/25 active:scale-95"
          >
            🏠
          </Link>
        )}
      </div>
    </main>
  );
}

/** Red "call ended" badge. */
export function EndedIcon() {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30] shadow-[0_8px_24px_rgba(255,59,48,0.45)]">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.4-1.4a2 2 0 0 1 2.1-.5 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 4.2 2 2 0 0 1 5.1 2h3a2 2 0 0 1 2 1.7 13 13 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1L8.6 10M22 2 2 22" />
      </svg>
    </span>
  );
}

export function EmojiIcon({ children }: { children: string }) {
  return <span className="text-5xl leading-none">{children}</span>;
}
