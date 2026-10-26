"use client";

import { useEffect, useRef } from "react";

/** RMS level (0..1) to a 0..1 meter position on a speech-friendly dB scale. */
export function rmsToMeter(rms: number) {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 55) / 50)); // -55 dB..-5 dB
}

/**
 * Live level bar. `read` is polled every animation frame and returns 0..1.
 * Updates the DOM directly so it doesn't re-render React 60 times a second.
 */
export function LevelMeter({
  read,
  label,
  dimmed = false,
  labelClass = "w-24",
}: {
  read: () => number;
  label: string;
  dimmed?: boolean;
  labelClass?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let frame = 0;
    let shown = 0;
    const tick = () => {
      const v = Math.min(1, Math.max(0, readRef.current() || 0));
      // Fast attack, slower release, like a real meter.
      shown = v > shown ? v : shown * 0.9 + v * 0.1;
      if (bar.current) {
        bar.current.style.width = `${(shown * 100).toFixed(1)}%`;
        bar.current.style.backgroundColor = shown > 0.92 ? "#f87171" : shown > 0.7 ? "#facc15" : "#4ade80";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`flex items-center gap-2 ${dimmed ? "opacity-40" : ""}`}>
      <span className={`${labelClass} shrink-0 text-xs text-neutral-400`}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800" role="img" aria-label={`${label} level`}>
        <div ref={bar} className="h-full w-0 rounded-full" />
      </div>
    </div>
  );
}
