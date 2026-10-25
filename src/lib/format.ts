export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });
}

export function fmtDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function callDurationSec(c: { startedAt: Date | null; endedAt: Date | null }) {
  if (!c.startedAt) return null;
  return ((c.endedAt ?? new Date()).getTime() - c.startedAt.getTime()) / 1000;
}

export function timeAgo(d: Date | null | undefined) {
  if (!d) return "never";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}
