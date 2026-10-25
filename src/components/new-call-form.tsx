"use client";

import { useActionState, useState } from "react";
import { createCall, type CreateCallState } from "@/app/dashboard/actions";
import { PRESET_LABELS, VOICE_PRESETS } from "@/lib/voice/presets";

export function NewCallForm({ canUseVoiceChanger }: { canUseVoiceChanger: boolean }) {
  const [state, action, pending] = useActionState<CreateCallState, FormData>(createCall, {});
  const [voiceOn, setVoiceOn] = useState(false);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4 rounded-xl border border-neutral-800 p-5">
      <h2 className="text-lg font-medium">New call</h2>

      <label className="block">
        <span className="text-sm text-neutral-400">Your alias for this call</span>
        <input
          name="alias"
          required
          minLength={2}
          maxLength={32}
          placeholder="e.g. Night Owl"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
        />
        {fe.alias && <span className="mt-1 block text-sm text-red-400">{fe.alias[0]}</span>}
      </label>

      <label className="block">
        <span className="text-sm text-neutral-400">Title guests see (optional)</span>
        <input
          name="hostTitle"
          maxLength={32}
          placeholder="e.g. Interviewer, Counsellor, Coach"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
        />
        {fe.hostTitle && <span className="mt-1 block text-sm text-red-400">{fe.hostTitle[0]}</span>}
      </label>

      <fieldset disabled={!canUseVoiceChanger} className="space-y-2 disabled:opacity-50">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="voiceChangerEnabled"
            checked={voiceOn}
            onChange={(e) => setVoiceOn(e.target.checked)}
          />
          <span>Disguise my voice</span>
          {!canUseVoiceChanger && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">PRO</span>
          )}
        </label>
        {voiceOn && (
          <select
            name="voicePreset"
            defaultValue="neutral-mask"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          >
            {VOICE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        )}
        {fe.voicePreset && <span className="block text-sm text-red-400">{fe.voicePreset[0]}</span>}
      </fieldset>

      <fieldset>
        <legend className="text-sm text-neutral-400">Guest camera</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 has-[:checked]:border-white">
            <input type="radio" name="guestCamera" value="OPTIONAL" defaultChecked />
            <span className="text-sm">Guest&apos;s choice</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 has-[:checked]:border-white">
            <input type="radio" name="guestCamera" value="REQUIRED" />
            <span className="text-sm">Required</span>
          </label>
        </div>
      </fieldset>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="recordingEnabled" />
        <span>Record and transcribe this call</span>
      </label>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-neutral-200 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create call"}
      </button>
    </form>
  );
}
