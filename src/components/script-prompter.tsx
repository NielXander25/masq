"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, PlayIcon } from "@/components/ui/icons";

/**
 * A private teleprompter. The script lives only in this tab's memory: it is
 * never sent anywhere, and it's gone when you leave the call.
 */
export function useScript() {
  const [text, setText] = useState("");
  const [showing, setShowing] = useState(false);
  return { text, setText, showing, setShowing };
}
export type Script = ReturnType<typeof useScript>;

/** Editor, shown in a sheet. */
export function ScriptEditor({ script, onRead }: { script: Script; onRead: () => void }) {
  const [draft, setDraft] = useState(script.text);
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Only you can see this. It isn&apos;t saved and disappears when you leave the call.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste or type what you want to say…"
        aria-label="Your script"
        rows={9}
        className="w-full resize-none rounded-2xl bg-white/5 p-4 text-[16px] leading-relaxed outline-none ring-1 ring-white/10 focus:ring-white/30"
      />
      <div className="flex gap-2">
        {script.text && (
          <button
            type="button"
            onClick={() => {
              script.setText("");
              script.setShowing(false);
              setDraft("");
            }}
            className="rounded-full bg-white/10 px-4 py-3 text-sm font-medium"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            script.setText(draft);
            script.setShowing(true);
            onRead();
          }}
          className="flex-1 rounded-full bg-white px-4 py-3 font-semibold text-black disabled:opacity-40"
        >
          Show on screen
        </button>
      </div>
    </div>
  );
}

/** The floating glass card you read from during the call. */
export function ScriptOverlay({ script, onEdit }: { script: Script; onEdit: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30); // pixels per second
  const [size, setSize] = useState(22);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      const el = box.current;
      if (el) {
        carry += ((now - last) / 1000) * speed;
        const step = Math.floor(carry);
        carry -= step;
        el.scrollTop += step;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) setPlaying(false);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  if (!script.showing || !script.text) return null;
  return (
    <div className="glass absolute inset-x-3 top-[4.5rem] z-30 mx-auto flex max-h-[42%] max-w-xl flex-col overflow-hidden rounded-[28px]">
      <div
        ref={box}
        onTouchStart={() => setPlaying(false)}
        onWheel={() => setPlaying(false)}
        className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-5 pb-2 pt-4 font-semibold text-white"
        style={{ fontSize: size, lineHeight: 1.4 }}
        aria-label="Script on screen"
      >
        {script.text}
        <div className="h-[30%]" />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/10 px-2.5 py-2 text-sm">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause scrolling" : "Scroll automatically"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black"
        >
          {playing ? <span className="text-xs font-bold">❚❚</span> : <PlayIcon className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setSpeed((v) => Math.max(10, v - 10))} aria-label="Slower" className="pill-btn">
          −
        </button>
        <span className="w-9 text-center text-xs tabular-nums text-neutral-300">{(speed / 30).toFixed(1)}×</span>
        <button type="button" onClick={() => setSpeed((v) => Math.min(120, v + 10))} aria-label="Faster" className="pill-btn">
          +
        </button>
        <button type="button" onClick={() => setSize((v) => Math.max(16, v - 2))} aria-label="Smaller text" className="pill-btn">
          A−
        </button>
        <button type="button" onClick={() => setSize((v) => Math.min(36, v + 2))} aria-label="Larger text" className="pill-btn">
          A+
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onEdit} className="pill-btn">
          Edit
        </button>
        <button
          type="button"
          onClick={() => script.setShowing(false)}
          aria-label="Hide script"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
