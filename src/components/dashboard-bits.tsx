"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShareIcon } from "@/components/ui/icons";
import { Avatar, Sheet } from "@/components/ui/primitives";

/** Paste an invite link or code and go to it. */
export function JoinWithLink() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    // Accept a full link (…/c/night-owl-k7m2xq9p) or just the code.
    const m = v.match(/\/c\/([\w-]+)/) ?? v.match(/^([\w-]{4,64})$/);
    if (!m) return setError("Paste the link you were sent, or its code.");
    router.push(`/c/${m[1]}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3.5 font-semibold ring-1 ring-white/10 transition hover:bg-white/15 active:scale-[0.98]"
      >
        Join with a link
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Join a call">
        <form onSubmit={go} className="space-y-3">
          <input
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Paste a link or code"
            className="ios-field"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary">Continue</button>
        </form>
      </Sheet>
    </>
  );
}

/** Avatar button opening a small account menu. */
export function AccountMenu({
  name,
  email,
  image,
  planLabel,
  signOut,
}: {
  name: string;
  email: string;
  image: string | null;
  planLabel: string;
  signOut: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Account" className="rounded-full">
        <Avatar name={name} image={image} size="h-9 w-9 text-sm" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Account">
        <div className="flex items-center gap-3">
          <Avatar name={name} image={image} />
          <div className="min-w-0">
            <div className="truncate font-medium">{name}</div>
            <div className="truncate text-sm text-neutral-400">{email}</div>
            <div className="text-xs text-neutral-500">{planLabel}</div>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {signOut}
        </div>
      </Sheet>
    </>
  );
}

/** Small round share button for a call row. */
export function ShareLinkButton({ url, alias }: { url: string; alias: string }) {
  const [copied, setCopied] = useState(false);
  async function share(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${alias} on masqq`, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={share}
      aria-label="Share invite link"
      className="flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-[#30d158] hover:bg-white/10"
    >
      {copied ? <span className="text-xs">Copied</span> : <ShareIcon className="h-5 w-5" />}
    </button>
  );
}

/** "Today, 14:05" / "Yesterday, 09:30" / "12 Oct, 18:00" in the viewer's own timezone. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    const now = new Date();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) setText(`Today, ${time}`);
    else if (d.toDateString() === y.toDateString()) setText(`Yesterday, ${time}`);
    else setText(`${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`);
  }, [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}
