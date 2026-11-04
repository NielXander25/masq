"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";

const SEEN = "masqq.splash";
const MIN_MS = 1400;
const MAX_MS = 3000;

/**
 * Launch screen for the installed app: the logo and a loading line, once per
 * launch. CSS shows it from the very first paint, but only when masqq runs as
 * an installed app; this hides it after a short moment (3 seconds at most).
 */
export function Splash() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.classList.contains("no-splash")) return setGone(true);
    const start = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Marked only once it has really shown, so the redirect that opening the
      // app goes through doesn't count as "already shown".
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        // Private mode: it just shows again next time.
      }
      setLeaving(true);
      setTimeout(() => setGone(true), 400);
    };
    const whenLoaded = () => setTimeout(finish, Math.max(0, MIN_MS - (performance.now() - start)));
    if (document.readyState === "complete") whenLoaded();
    else window.addEventListener("load", whenLoaded, { once: true });
    const cap = setTimeout(finish, MAX_MS);
    return () => {
      clearTimeout(cap);
      window.removeEventListener("load", whenLoaded);
    };
  }, []);

  if (gone) return null;
  return (
    <div className={`splash ${leaving ? "splash-leave" : ""}`} aria-hidden>
      <div className="flex flex-col items-center">
        <div className="splash-logo rounded-[30px] bg-gradient-to-b from-neutral-800 to-neutral-950 p-3 shadow-2xl ring-1 ring-white/10">
          <LogoMark className="h-20 w-20" />
        </div>
        <p className="mt-5 text-[26px] font-bold tracking-tight">masqq</p>
        <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="splash-line h-full rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

/** Before first paint: skip the splash if it already showed this launch. */
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("${SEEN}"))document.documentElement.classList.add("no-splash")}catch(e){}`;
