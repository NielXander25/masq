"use client";

import { useEffect, useState } from "react";

type InApp = { app: string; android: boolean } | null;

/** Built-in browsers inside other apps, where Google sign-in can fail. */
function detect(): InApp {
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const named: [RegExp, string][] = [
    [/WhatsApp/i, "WhatsApp"],
    [/Instagram/i, "Instagram"],
    [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
    [/Snapchat/i, "Snapchat"],
    [/TikTok|musical_ly|BytedanceWebview/i, "TikTok"],
    [/\bLine\//i, "LINE"],
    [/Twitter/i, "X"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Telegram/i, "Telegram"],
  ];
  for (const [re, app] of named) if (re.test(ua)) return { app, android };
  // Generic webviews: Android marks them "; wv)", iOS ones lack "Safari/".
  if (android && /; wv\)/.test(ua)) return { app: "this app", android };
  if (ios && !/Safari\//.test(ua)) return { app: "this app", android };
  return null;
}

/** Tells people inside WhatsApp & co. to open masqq in Chrome or Safari. */
export function InAppBrowserNotice() {
  const [inApp, setInApp] = useState<InApp>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setInApp(detect()), []);
  if (!inApp) return null;

  const url = location.href;
  const chromeIntent = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;

  return (
    <div className="mb-4 rounded-[22px] bg-amber-500/10 p-4 text-left ring-1 ring-amber-500/25">
      <p className="text-[15px] font-semibold text-amber-200">Open masqq in {inApp.android ? "Chrome" : "Safari"}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-100/80">
        You&apos;re in {inApp.app}&apos;s built-in browser, where Google sign-in may not work.{" "}
        {inApp.android ? "Tap below, or use ⋮ → Open in Chrome." : "Tap ••• or the compass icon → Open in Safari."}
      </p>
      <div className="mt-3 flex gap-2">
        {inApp.android && (
          <a href={chromeIntent} className="flex-1 rounded-full bg-white py-2.5 text-center text-sm font-semibold text-black">
            Open in Chrome
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              // Clipboard blocked: the steps above still work.
            }
          }}
          className="flex-1 rounded-full bg-white/10 py-2.5 text-sm font-semibold"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
