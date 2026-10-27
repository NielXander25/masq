"use client";

import Link from "next/link";
import { MODE_COOKIE, type Mode } from "@/lib/mode";

/** Personal / Admin segmented switch, shown to admins only. */
export function ModeSwitch({ current }: { current: Mode }) {
  function remember(mode: Mode) {
    document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  }
  const item = (mode: Mode, href: string, label: string) => (
    <Link
      href={href}
      onClick={() => remember(mode)}
      aria-current={current === mode ? "page" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        current === mode
          ? mode === "admin"
            ? "bg-amber-500 text-black"
            : "bg-white text-black"
          : "text-neutral-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Mode" className="flex rounded-full bg-neutral-900 p-1">
      {item("personal", "/dashboard", "Personal")}
      {item("admin", "/admin", "Admin")}
    </nav>
  );
}
