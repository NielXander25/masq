import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { db } from "@/lib/db";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { r2Configured, r2SignedUrl } from "@/lib/r2";
import { clock } from "@/lib/transcribe/merge";
import { readSegments } from "@/lib/transcribe/read";
import { requireUser } from "@/lib/session";

export default async function CallRecordingPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const user = await requireUser(`/dashboard/calls/${callId}`);
  // Host only.
  const call = await db.call.findFirst({
    where: { id: callId, hostId: user.id },
    select: {
      id: true,
      hostAlias: true,
      status: true,
      startedAt: true,
      endedAt: true,
      recordingEnabled: true,
      recordings: {
        select: {
          kind: true,
          fileKey: true,
          status: true,
          durationSec: true,
          startedAt: true,
          participant: { select: { isHost: true, user: { select: { name: true, email: true } } } },
        },
        orderBy: { startedAt: "asc" },
      },
      transcript: { select: { status: true, segments: true } },
    },
  });
  if (!call) notFound();

  const mixed = call.recordings.find((r) => r.kind === "MIXED" && r.status === "DONE");
  const audioReady = Boolean(mixed?.fileKey) && r2Configured();
  // Without a room mix (e.g. the plan's recording limit was hit), offer each speaker's track.
  const tracks = r2Configured()
    ? call.recordings
        .filter((r) => r.kind === "TRACK" && r.status === "DONE" && r.fileKey)
        .map((r) => ({
          label: !r.participant || r.participant.isHost ? `${call.hostAlias} (you)` : (r.participant.user.name ?? r.participant.user.email),
          url: r2SignedUrl(r.fileKey!),
          downloadUrl: r2SignedUrl(r.fileKey!, { downloadName: `masqq-${call.id}-${r.fileKey!.split("/").pop()}` }),
        }))
    : [];
  const anyPending = call.recordings.some((r) => r.status === "PENDING" || r.status === "PROCESSING");
  const allFailed = call.recordings.length > 0 && call.recordings.every((r) => r.status === "FAILED");
  const duration = mixed?.durationSec ?? Math.max(0, ...call.recordings.map((r) => r.durationSec ?? 0));
  // Signed links expire after an hour.
  const mixedKey = audioReady ? mixed?.fileKey : null;
  const audioUrl = mixedKey ? r2SignedUrl(mixedKey) : null;
  const downloadUrl = mixedKey
    ? r2SignedUrl(mixedKey, { downloadName: `masqq-${call.hostAlias}-${call.id}.ogg` })
    : null;
  const segments = readSegments(call.transcript?.segments);

  return (
    <main className="relative isolate mx-auto max-w-3xl px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgba(129,140,248,0.14),transparent_70%)]" />
      <header className="flex items-center justify-between">
        <Link
          href="/dashboard"
          aria-label="Back to calls"
          className="glass flex h-10 items-center gap-1 rounded-full pl-2 pr-4 text-sm font-medium"
        >
          <ChevronLeftIcon className="h-5 w-5" /> Calls
        </Link>
        <Logo className="text-lg" />
      </header>

      <h1 className="mt-6 px-1 text-[30px] font-bold leading-tight tracking-tight">{call.hostAlias}</h1>
      <p className="mt-1 px-1 text-sm text-neutral-400">
        {fmtDateTime(call.startedAt)}
        {duration ? ` · ${fmtDuration(duration)}` : ""}
      </p>

      {!call.recordingEnabled ? (
        <p className="glass mt-5 rounded-[22px] p-5 text-center text-neutral-400">This call wasn&apos;t recorded.</p>
      ) : (
        <>
          <section className="glass mt-5 rounded-[22px] p-4">
            <h2 className="mb-3 font-medium">Recording</h2>
            {audioUrl ? (
              <>
                <audio controls preload="metadata" src={audioUrl} className="w-full" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={downloadUrl!} className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/15">
                    Download audio (.ogg)
                  </a>
                  {call.transcript?.status === "DONE" && (
                    <a
                      href={`/api/calls/${call.id}/transcript`}
                      className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Download transcript (.txt)
                    </a>
                  )}
                </div>
              </>
            ) : tracks.length && !anyPending ? (
              <div className="space-y-4">
                <p className="text-xs text-neutral-500">Each speaker was recorded separately.</p>
                {tracks.map((t, i) => (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{t.label}</span>
                      <a href={t.downloadUrl} className="text-xs text-neutral-400 underline">
                        Download
                      </a>
                    </div>
                    <audio controls preload="metadata" src={t.url} className="w-full" />
                  </div>
                ))}
                {call.transcript?.status === "DONE" && (
                  <a
                    href={`/api/calls/${call.id}/transcript`}
                    className="inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/15"
                  >
                    Download transcript (.txt)
                  </a>
                )}
              </div>
            ) : allFailed ? (
              <p className="text-sm text-red-400">The recording failed.</p>
            ) : call.status !== "ENDED" ? (
              <p className="text-sm text-neutral-400">The call is still going. The recording appears here after it ends.</p>
            ) : (
              <p className="text-sm text-neutral-400">Processing the recording… refresh in a minute.</p>
            )}
          </section>

          <section className="glass mt-5 rounded-[22px] p-4">
            <h2 className="mb-3 font-medium">Transcript</h2>
            {call.transcript?.status === "DONE" ? (
              segments.length ? (
                <ol className="space-y-3">
                  {segments.map((s, i) => (
                    <li key={i} className="text-sm">
                      <span className="mr-2 font-mono text-xs text-neutral-500">{clock(s.startMs)}</span>
                      <span className="font-medium">{s.speakerLabel}</span>
                      <p className="mt-0.5 text-neutral-300">{s.text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-neutral-400">No speech was detected.</p>
              )
            ) : call.transcript?.status === "FAILED" ? (
              <p className="text-sm text-red-400">Transcription failed.</p>
            ) : (
              <p className="text-sm text-neutral-400">
                {call.status === "ENDED" ? "Transcribing… we'll email you when it's ready." : "Available after the call ends."}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
