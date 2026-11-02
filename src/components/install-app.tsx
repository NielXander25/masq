"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { IosShareIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/primitives";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const useInstall = create<{ prompt: InstallPrompt | null; installed: boolean }>(() => ({
  prompt: null,
  installed: false,
}));

/**
 * Mounted once in the root layout: registers the service worker and keeps the
 * browser's install prompt (it only fires once, early) for the Install button.
 */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    useInstall.setState({ installed: standalone });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      useInstall.setState({ prompt: e as InstallPrompt });
    };
    const onInstalled = () => useInstall.setState({ installed: true, prompt: null });
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** What the Install button can do here: prompt, show iPhone steps, or nothing. */
function useInstallMode() {
  const { prompt, installed } = useInstall();
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(isIOS()), []);
  if (installed) return null;
  if (prompt) return "prompt" as const;
  if (ios) return "ios" as const;
  return null;
}

/** "Install app" button; renders nothing when masqq is installed or can't be. */
export function InstallAppButton({
  className = "btn-secondary w-full",
  label = "📲 Install app",
}: {
  className?: string;
  label?: string;
}) {
  const mode = useInstallMode();
  const [steps, setSteps] = useState(false);
  if (!mode) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (mode === "ios") return setSteps(true);
          const p = useInstall.getState().prompt;
          if (!p) return;
          await p.prompt();
          const choice = await p.userChoice.catch(() => null);
          useInstall.setState({ prompt: null, installed: choice?.outcome === "accepted" });
        }}
      >
        {label}
      </button>
      <Sheet open={steps} onClose={() => setSteps(false)} title="Add masqq to your Home Screen">
        <ol className="space-y-3">
          <Step n={1}>
            Tap <IosShareIcon className="mx-1 inline h-5 w-5 align-text-bottom text-[#0a84ff]" /> <b>Share</b> in Safari&apos;s
            toolbar.
          </Step>
          <Step n={2}>
            Scroll down and tap <b>Add to Home Screen</b>.
          </Step>
          <Step n={3}>
            Tap <b>Add</b>. masqq opens full screen, like an app.
          </Step>
        </ol>
        <button type="button" onClick={() => setSteps(false)} className="btn-primary mt-5">
          Got it
        </button>
      </Sheet>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-white/[0.06] p-3.5 text-[15px] leading-relaxed">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

const DISMISSED = "masqq.install-card-dismissed";

/** A dismissible "Get the app" card for the home screen. */
export function InstallAppCard() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (!mode || dismissed) return null;
  return (
    <div className="glass mt-4 flex items-center gap-3 rounded-[22px] p-3 pl-4">
      <span className="text-2xl">📲</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">Get the masqq app</div>
        <div className="truncate text-[13px] text-neutral-400">On your Home Screen, full screen</div>
      </div>
      <InstallAppButton label="Install" className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black" />
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISSED, "1");
          } catch {
            // Fine: it just shows again next time.
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10"
      >
        ✕
      </button>
    </div>
  );
}
