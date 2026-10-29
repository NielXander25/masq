"use client";

import { useEffect } from "react";
import { CloseIcon } from "./icons";

/** Round icon button, as in Meet / WhatsApp call controls. */
export function RoundButton({
  label,
  onClick,
  children,
  tone = "default",
  disabled,
  badge,
  pressed,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "default" | "off" | "danger" | "light";
  disabled?: boolean;
  badge?: number;
  pressed?: boolean;
  className?: string;
}) {
  const tones = {
    // iOS call controls: frosted glass; a switched-off control turns white.
    default: "bg-white/15 text-white hover:bg-white/25",
    off: "bg-white text-black hover:bg-neutral-200",
    danger: "bg-[#ff3b30] text-white hover:bg-red-500",
    light: "bg-white text-black hover:bg-neutral-200",
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur-xl transition active:scale-95 disabled:opacity-40 sm:h-14 sm:w-14 ${tones[tone]} ${className}`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-bold text-white ring-2 ring-black/60">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="sheet-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border-t border-white/10 bg-neutral-900/80 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-[0_-10px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150 sm:max-w-md sm:rounded-[32px] sm:border">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/25 sm:hidden" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-neutral-300 hover:bg-white/20">
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** iOS/Android style on-off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  name,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2.5 ${disabled ? "opacity-50" : ""}`}>
      <span>{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          name={name}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-[31px] w-[51px] rounded-full bg-white/20 transition peer-checked:bg-[#30d158] peer-focus-visible:ring-2 peer-focus-visible:ring-white" />
        <span className="absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.3)] transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const AVATAR_COLOURS = ["bg-rose-600", "bg-amber-600", "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-fuchsia-600", "bg-teal-600"];

/** Initials avatar; colour is stable per name. Uses `image` when given. */
export function Avatar({ name, image, size = "h-11 w-11 text-base" }: { name: string; image?: string | null; size?: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${size} shrink-0 rounded-full object-cover`} referrerPolicy="no-referrer" />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={`${size} ${AVATAR_COLOURS[h % AVATAR_COLOURS.length]} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}>
      {initials || "?"}
    </span>
  );
}
