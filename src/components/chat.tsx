"use client";

import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon } from "@/components/ui/icons";
import { CHAT_MAX_LENGTH, CHAT_TOPIC, type ChatMessage } from "@/lib/chat";

const POPUP_MS = 5000;
const decoder = new TextDecoder();

/**
 * In-call chat. Messages are sent through our API (stored for the length of
 * the call) and relayed by the server, so a sender's name can't be faked.
 */
export function useChat(callId: string, open: boolean) {
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [popups, setPopups] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const seen = useRef(new Set<string>());

  const add = useCallback(
    (m: ChatMessage, announce: boolean) => {
      if (seen.current.has(m.id)) return;
      seen.current.add(m.id);
      setMessages((prev) => [...prev, m].slice(-200));
      if (!announce) return;
      const mine = m.identity === localParticipant.identity;
      if (!openRef.current) {
        if (!mine) setUnread((n) => n + 1);
        setPopups((prev) => [...prev.slice(-2), m]);
        setTimeout(() => setPopups((prev) => prev.filter((x) => x.id !== m.id)), POPUP_MS);
      }
    },
    [localParticipant.identity],
  );

  // History, for anyone joining or rejoining mid-call.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calls/${callId}/messages`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d: { messages: ChatMessage[] }) => {
        if (!cancelled) d.messages.forEach((m) => add(m, false));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [callId, add]);

  useDataChannel(CHAT_TOPIC, (msg) => {
    // Only trust messages relayed by the server (participants can't send these).
    if (msg.from) return;
    try {
      add(JSON.parse(decoder.decode(msg.payload)) as ChatMessage, true);
    } catch {
      // Ignore anything malformed.
    }
  });

  useEffect(() => {
    if (open) {
      setUnread(0);
      setPopups([]);
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      setError(null);
      const res = await fetch(`/api/calls/${callId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Message not sent");
        return false;
      }
      add(data.message, true);
      return true;
    },
    [callId, add],
  );

  return { messages, popups, unread, error, send, myIdentity: localParticipant.identity };
}

export type Chat = ReturnType<typeof useChat>;

/** New messages pop up in the middle of everyone's screen for a few seconds. */
export function ChatPopups({ chat, onOpen }: { chat: Chat; onOpen: () => void }) {
  if (chat.popups.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 px-6">
      {chat.popups.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={onOpen}
          className="chat-pop pointer-events-auto w-full max-w-sm rounded-3xl bg-neutral-900/90 px-5 py-4 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-md"
        >
          <div className={`text-xs font-semibold ${m.isHost ? "text-green-400" : "text-neutral-300"}`}>
            {m.identity === chat.myIdentity ? "You" : m.from}
          </div>
          <div className="mt-1 line-clamp-4 break-words text-lg font-medium leading-snug text-white">{m.text}</div>
        </button>
      ))}
    </div>
  );
}

/** The chat sheet: history plus a message box. */
export function ChatPanel({ chat }: { chat: Chat }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    if (await chat.send(t)) setText("");
    setSending(false);
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[50dvh] min-h-[30dvh] space-y-2 overflow-y-auto pb-2">
        {chat.messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-neutral-500">
            No messages yet. Messages pop up for everyone and are deleted when the call ends.
          </p>
        ) : (
          chat.messages.map((m) => {
            const mine = m.identity === chat.myIdentity;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    mine ? "rounded-br-md bg-green-600 text-white" : "rounded-bl-md bg-neutral-800"
                  }`}
                >
                  {!mine && (
                    <div className={`text-xs font-semibold ${m.isHost ? "text-green-400" : "text-neutral-400"}`}>
                      {m.from}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[15px]">{m.text}</div>
                  <div className={`mt-0.5 text-right text-[10px] ${mine ? "text-green-100/80" : "text-neutral-500"}`}>
                    {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>
      {chat.error && <p className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{chat.error}</p>}
      <form onSubmit={submit} className="flex items-center gap-2 pt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Message everyone"
          aria-label="Message"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full bg-neutral-800 px-4 py-3 text-[16px] outline-none ring-1 ring-white/10 focus:ring-white/30"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send message"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-black disabled:opacity-40"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
