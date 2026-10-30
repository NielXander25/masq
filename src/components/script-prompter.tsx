"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, PencilIcon, PlayIcon } from "@/components/ui/icons";

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
  const [height, setHeight] = useState(() => clampHeight(typeof window === "undefined" ? 320 : window.innerHeight * 0.42));

  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const resize = {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, h: height, moved: false };
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      if (!d) return;
      if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
      if (d.moved) setHeight(clampHeight(d.h + e.clientY - d.y));
    },
    onPointerUp() {
      const d = drag.current;
      drag.current = null;
      // A tap (no drag) toggles between a small card and a tall one.
      if (d && !d.moved) {
        const tall = clampHeight(window.innerHeight * 0.7);
        setHeight(d.h >= tall - 20 ? clampHeight(window.innerHeight * 0.42) : tall);
      }
    },
    onPointerCancel() {
      drag.current = null;
    },
  };

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
    <div
      className="glass absolute inset-x-3 top-[4.5rem] z-30 mx-auto max-w-xl overflow-hidden rounded-[28px]"
      style={{ height }}
    >
      <div
        ref={box}
        onTouchStart={() => setPlaying(false)}
        onWheel={() => setPlaying(false)}
        className="h-full overflow-y-auto whitespace-pre-wrap pb-28 pl-5 pr-12 pt-4 font-semibold text-white"
        style={{ fontSize: size, lineHeight: 1.4 }}
        aria-label="Script on screen"
      >
        {script.text}
      </div>

      {/* Close, floating in the corner. */}
      <button
        type="button"
        onClick={() => script.setShowing(false)}
        aria-label="Hide script"
        className="script-btn absolute right-2.5 top-2.5 !h-9 !w-9"
      >
        <CloseIcon className="h-4 w-4" />
      </button>

      {/* Round floating controls over a black fade, so the text slides under them. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pb-1 pt-10">
        <div className="pointer-events-auto flex items-center justify-center gap-1.5 px-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause scrolling" : "Scroll automatically"}
            className="script-btn !bg-white !text-black"
          >
            {playing ? <span className="text-xs font-bold">❚❚</span> : <PlayIcon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setSpeed((v) => Math.max(10, v - 10))} aria-label="Slower" className="script-btn">
            −
          </button>
          <span className="w-9 text-center text-xs font-semibold tabular-nums text-neutral-300">
            {(speed / 30).toFixed(1)}×
          </span>
          <button type="button" onClick={() => setSpeed((v) => Math.min(120, v + 10))} aria-label="Faster" className="script-btn">
            +
          </button>
          <button type="button" onClick={() => setSize((v) => Math.max(16, v - 2))} aria-label="Smaller text" className="script-btn text-[13px]">
            A−
          </button>
          <button type="button" onClick={() => setSize((v) => Math.min(40, v + 2))} aria-label="Larger text" className="script-btn text-[15px]">
            A+
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit script" className="script-btn">
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>
        {/* Drag to resize the card; tap to switch between small and tall. */}
        <div
          role="slider"
          aria-label="Script size"
          aria-valuenow={Math.round(height)}
          tabIndex={0}
          {...resize}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setHeight((h) => clampHeight(h + 40));
            if (e.key === "ArrowUp") setHeight((h) => clampHeight(h - 40));
          }}
          className="pointer-events-auto mx-auto flex h-6 w-24 cursor-ns-resize touch-none items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-white/50" />
        </div>
      </div>
    </div>
  );
}

/** The card can grow from a strip to most of the screen, leaving the dock clear. */
function clampHeight(h: number) {
  const max = typeof window === "undefined" ? 600 : window.innerHeight - 72 - 120;
  return Math.max(140, Math.min(max, h));
}
