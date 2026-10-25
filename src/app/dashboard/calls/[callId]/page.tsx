import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
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
        where: { kind: "MIXED" },
        select: { fileKey: true, status: true, durationSec: true },
      },
      transcript: { select: { status: true, segments: true } },
    },
  });
  if (!call) notFound();

  const mixed = call.recordings[0];
  const audioReady = mixed?.status === "DONE" && mixed.fileKey && r2Configured();
  // Signed links expire after an hour.
  const audioUrl = audioReady ? r2SignedUrl(mixed.fileKey!) : null;
  const downloadUrl = audioReady
    ? r2SignedUrl(mixed.fileKey!, { downloadName: `masqq-${call.hostAlias}-${call.id}.ogg` })
    : null;
  const segments = readSegments(call.transcript?.segments);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/dashboard">
          <Logo className="text-xl" />
        </Link>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ← Dashboard
        </Link>
      </header>

      <h1 className="mt-8 text-2xl font-semibold">{call.hostAlias}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {fmtDateTime(call.startedAt)}
        {mixed?.durationSec ? ` · ${fmtDuration(mixed.durationSec)}` : ""}
      </p>

      {!call.recordingEnabled ? (
        <p className="mt-6 text-neutral-400">This call wasn&apos;t recorded.</p>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-neutral-800 p-4">
            <h2 className="mb-3 font-medium">Recording</h2>
            {audioUrl ? (
              <>
                <audio controls preload="metadata" src={audioUrl} className="w-full" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={downloadUrl!} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800">
                    Download audio (.ogg)
                  </a>
                  {call.transcript?.status === "DONE" && (
                    <a
                      href={`/api/calls/${call.id}/transcript`}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                    >
                      Download transcript (.txt)
                    </a>
                  )}
                </div>
              </>
            ) : mixed?.status === "FAILED" ? (
              <p className="text-sm text-red-400">The recording failed.</p>
            ) : call.status !== "ENDED" ? (
              <p className="text-sm text-neutral-400">The call is still going. The recording appears here after it ends.</p>
            ) : (
              <p className="text-sm text-neutral-400">Processing the recording… refresh in a minute.</p>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-neutral-800 p-4">
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
