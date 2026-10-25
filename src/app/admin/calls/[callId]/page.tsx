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
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-800">
                <th className="p-3">Who</th>
                <th className="p-3">Status</th>
                <th className="p-3">Consented</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {call.participants.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    {p.isHost ? (
                      <span>
                        <span className="font-medium">{call.hostAlias}</span>{" "}
                        <span className="text-xs text-neutral-500">host · {p.livekitIdentity}</span>
                      </span>
                    ) : (
                      <span>
                        <span className="font-medium">{p.user.name ?? "—"}</span>{" "}
                        <span className="text-neutral-400">{p.user.email}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge>{p.status}</Badge>
                  </td>
                  <td className="p-3 text-neutral-400">{p.isHost ? "—" : fmtDateTime(p.consentedAt)}</td>
                  <td className="p-3 text-neutral-400">{fmtDateTime(p.joinedAt)}</td>
                  <td className="p-3 text-neutral-400">{fmtDateTime(p.leftAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
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
