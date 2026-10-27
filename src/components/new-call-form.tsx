"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createCall, type CreateCallState } from "@/app/dashboard/actions";
import { CopyIcon, LinkIcon, PlusIcon, ShareIcon } from "@/components/ui/icons";
import { Sheet, Switch } from "@/components/ui/primitives";
import { PRESET_LABELS, VOICE_PRESETS } from "@/lib/voice/presets";

type Props = { canUseVoiceChanger: boolean; canRecord: boolean };

/** "New call" button (and floating + on phones) opening the create-call sheet. */
export function NewCallButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-black hover:bg-neutral-200"
      >
        <LinkIcon className="h-5 w-5" />
        New call link
      </button>
      {/* Floating action button, WhatsApp-style, on phones. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="New call"
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500 text-black shadow-lg shadow-black/40 sm:hidden"
      >
        <PlusIcon className="h-7 w-7" />
      </button>
      {/* Remount on each open so a previous result doesn't linger. */}
      {open && <NewCallSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewCallSheet({ canUseVoiceChanger, canRecord, onClose }: Props & { onClose: () => void }) {
  const [state, action, pending] = useActionState<CreateCallState, FormData>(createCall, {});
  // Anonymity is the point: the disguise starts on for anyone who can use it.
  const [voiceOn, setVoiceOn] = useState(canUseVoiceChanger);
  const [preset, setPreset] = useState<(typeof VOICE_PRESETS)[number]>("deep");
  const [camera, setCamera] = useState<"OPTIONAL" | "REQUIRED">("OPTIONAL");
  const [record, setRecord] = useState(false);
  const fe = state.fieldErrors ?? {};

  if (state.created) {
    return (
      <Sheet open onClose={onClose} title="Your call link is ready">
        <CreatedCall {...state.created} onClose={onClose} />
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="New call">
      <form action={action} className="space-y-5">
        <label className="block">
          <span className="text-sm text-neutral-400">Name guests see</span>
          <input
            name="alias"
            required
            minLength={2}
            maxLength={32}
            autoFocus
            placeholder="e.g. Night Owl"
            className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base outline-none focus:border-neutral-400"
          />
          {fe.alias && <span className="mt-1 block text-sm text-red-400">{fe.alias[0]}</span>}
        </label>

        <label className="block">
          <span className="text-sm text-neutral-400">Title (optional)</span>
          <input
            name="hostTitle"
            maxLength={32}
            placeholder="e.g. Interviewer, Counsellor, Coach"
            className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base outline-none focus:border-neutral-400"
          />
          {fe.hostTitle && <span className="mt-1 block text-sm text-red-400">{fe.hostTitle[0]}</span>}
        </label>

        <div className="rounded-2xl bg-neutral-950 px-4 py-2">
          <Switch
            name="voiceChangerEnabled"
            label="Disguise my voice"
            checked={voiceOn}
            onChange={setVoiceOn}
            disabled={!canUseVoiceChanger}
          />
          {voiceOn ? (
            <div className="flex flex-wrap gap-2 pb-2">
              <input type="hidden" name="voicePreset" value={preset} />
              {VOICE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`rounded-full px-3.5 py-1.5 text-sm ${p === preset ? "bg-white text-black" : "bg-neutral-800 text-neutral-200"}`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>
          ) : (
            <p className="pb-2 text-xs text-amber-300">
              {canUseVoiceChanger
                ? "Off: guests will hear your real voice."
                : "Voice disguise is a PRO feature. Guests will hear your real voice."}
            </p>
          )}
          {fe.voicePreset && <p className="pb-2 text-sm text-red-400">{fe.voicePreset[0]}</p>}
          <div className="border-t border-neutral-800" />
          <div className="flex items-center justify-between gap-4 py-2">
            <span>Guest camera</span>
            <input type="hidden" name="guestCamera" value={camera} />
            <div className="flex rounded-full bg-neutral-800 p-0.5 text-sm">
              {(["OPTIONAL", "REQUIRED"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCamera(v)}
                  className={`rounded-full px-3 py-1 ${camera === v ? "bg-white text-black" : "text-neutral-300"}`}
                >
                  {v === "OPTIONAL" ? "Their choice" : "Required"}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-neutral-800" />
          <Switch
            name="recordingEnabled"
            label={canRecord ? "Record and transcribe" : "Record and transcribe (coming soon)"}
            checked={record}
            onChange={setRecord}
            disabled={!canRecord}
          />
        </div>

        {state.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-white px-4 py-3.5 font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create call link"}
        </button>
      </form>
    </Sheet>
  );
}

/** The link, ready to share, without having to join the call first. */
function CreatedCall({
  callId,
  inviteUrl,
  alias,
  onClose,
}: {
  callId: string;
  inviteUrl: string;
  alias: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  async function share() {
    try {
      await navigator.share({ title: `Join ${alias} on masqq`, url: inviteUrl });
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Share this link. Guests ask to join and you let them in, whenever you start the call as{" "}
        <span className="text-white">{alias}</span>.
      </p>
      <button
        onClick={copy}
        className="flex w-full items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-left"
        aria-label="Copy link"
      >
        <LinkIcon className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{inviteUrl.replace(/^https?:\/\//, "")}</span>
        <span className="shrink-0 text-sm text-green-400">{copied ? "Copied" : <CopyIcon className="h-5 w-5" />}</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        {canShare ? (
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-semibold text-black"
          >
            <ShareIcon className="h-5 w-5" /> Share
          </button>
        ) : (
          <button
            onClick={copy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-semibold text-black"
          >
            <CopyIcon className="h-5 w-5" /> {copied ? "Copied" : "Copy link"}
          </button>
        )}
        <Link
          href={`/call/${callId}`}
          className="flex items-center justify-center rounded-2xl bg-white px-4 py-3 font-semibold text-black"
        >
          Join now
        </Link>
      </div>
      <button onClick={onClose} className="w-full py-2 text-sm text-neutral-400">
        Done, I&apos;ll join later
      </button>
    </div>
  );
}
