import { z } from "zod";

// Names that could make a host look like platform staff.
const BLOCKED_SUBSTRINGS = [
  "admin",
  "support",
  "masq",
  "moderator",
  "official",
  "helpdesk",
  "customerservice",
  "trustandsafety",
  "system",
];
const BLOCKED_EXACT = ["mod", "mods", "staff", "team", "owner", "root", "security", "help"];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
};

/** Lowercase, undo common look-alike swaps, and drop everything but letters. */
function normalise(alias: string) {
  return alias
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[0-9@$!|]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "");
}

export function isBlockedAlias(alias: string) {
  const n = normalise(alias);
  return BLOCKED_EXACT.includes(n) || BLOCKED_SUBSTRINGS.some((s) => n.includes(s));
}

/** Optional role shown to guests next to the alias, e.g. "Interviewer". */
export const hostTitleSchema = z
  .string()
  .trim()
  .max(32, "Title must be at most 32 characters")
  .regex(/^[\p{L}\p{N} _.'-]*$/u, "Use letters, numbers, spaces, and _ . ' - only")
  .refine((t) => t === "" || !isBlockedAlias(t), "That title isn't allowed")
  .transform((t) => t || null);

export const aliasSchema = z
  .string()
  .trim()
  .min(2, "Alias must be at least 2 characters")
  .max(32, "Alias must be at most 32 characters")
  .regex(/^[\p{L}\p{N} _.'-]+$/u, "Use letters, numbers, spaces, and _ . ' - only")
  .refine((a) => !isBlockedAlias(a), "That alias isn't allowed");

/** How the host appears in the call: "Night Owl | Interviewer", or just the name. */
export function hostDisplayName(alias: string, purpose?: string | null) {
  return purpose ? `${alias} | ${purpose}` : alias;
}

/** The name part of a participant name ("Night Owl | Interviewer" -> "Night Owl"). */
export function baseName(name: string) {
  return name.split(/ [|·] /)[0] ?? name;
}
