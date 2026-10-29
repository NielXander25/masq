import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordingAccess, RevealHost } from "@/components/admin-controls";
import { Badge, Empty, Stat } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { callDurationSec, fmtDateTime, fmtDuration } from "@/lib/format";

export default async function AdminCallDetail({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const call = await db.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      hostAlias: true,
      hostTitle: true,
      status: true,
      createdAt: true,
      startedAt: true,
      endedAt: true,
      voiceChangerEnabled: true,
      voicePreset: true,
      recordingEnabled: true,
      guestCamera: true,
      // The host's account is never selected here: it is only shown via Reveal.
      participants: {
        orderBy: [{ isHost: "desc" }, { consentedAt: "asc" }],
        select: {
          id: true,
          isHost: true,
          status: true,
          consentedAt: true,
          joinedAt: true,
          leftAt: true,
          livekitIdentity: true,
          user: { select: { name: true, email: true } },
        },
      },
      recordings: { select: { id: true, kind: true, status: true, durationSec: true } },
      transcript: { select: { status: true } },
      reports: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reason: true, status: true, createdAt: true, reporter: { select: { email: true } } },
      },
    },
  });
  if (!call) notFound();

  const openReport = call.reports.some((r) => r.status === "OPEN");

  return (
    <div className="space-y-6">
      <Link href="/admin/calls" className="text-sm text-neutral-400 hover:text-white">
        ← All calls
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{call.hostAlias}</h1>
        {call.hostTitle && <span className="text-neutral-400">{call.hostTitle}</span>}
        <Badge>{call.status}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
        Real host: <RevealHost callId={call.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Duration" value={fmtDuration(callDurationSec(call))} sub={`Started ${fmtDateTime(call.startedAt)}`} />
        <Stat label="Voice changer" value={call.voiceChangerEnabled ? (call.voicePreset ?? "on") : "off"} />
        <Stat label="Guest camera" value={call.guestCamera === "REQUIRED" ? "Required" : "Optional"} />
        <Stat label="Recording" value={call.recordingEnabled ? "On" : "Off"} sub={`${call.recordings.length} files`} />
      </div>

      <section>
        <h2 className="mb-2 font-medium">Participants</h2>
        <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          {call.participants.map((p) => (
            <li key={p.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.isHost ? call.hostAlias : (p.user.name ?? "—")}</span>
                <Badge>{p.status}</Badge>
              </div>
              <div className="break-all text-sm text-neutral-400">
                {p.isHost ? `Host · ${p.livekitIdentity}` : p.user.email}
              </div>
              <div className="text-xs text-neutral-500">
                {!p.isHost && <>Consented {fmtDateTime(p.consentedAt)} · </>}
                Joined {fmtDateTime(p.joinedAt)} · Left {fmtDateTime(p.leftAt)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Recording and transcript</h2>
        {call.recordings.length === 0 && !call.transcript ? (
          <Empty>No recordings for this call.</Empty>
        ) : openReport ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">
              Available because this call has an open report. Opening it is audit-logged.
            </p>
            <RecordingAccess callId={call.id} />
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            Recording and transcript access requires an open report on this call.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Reports</h2>
        {call.reports.length === 0 ? (
          <Empty>No reports for this call.</Empty>
        ) : (
          <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
            {call.reports.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge>{r.status}</Badge>
                  <span className="text-neutral-400">
                    {r.reporter.email} · {fmtDateTime(r.createdAt)}
                  </span>
                </div>
                <p className="mt-1">{r.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
