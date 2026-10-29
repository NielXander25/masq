// In-call chat, shared by the API and the call screen.
export const CHAT_TOPIC = "chat";
export const CHAT_MAX_LENGTH = 500;

/** A chat message as everyone in the call sees it (the host by alias only). */
export type ChatMessage = {
  id: string;
  text: string;
  at: string;
  from: string;
  isHost: boolean;
  /** The sender's LiveKit identity (random for the host), to tell "mine" apart. */
  identity: string;
};
