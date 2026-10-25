import { env } from "@/env";

/** "Night Owl!" -> "night-owl". Empty if nothing usable is left. */
function slugify(alias: string) {
  return alias
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "");
}

/** Invite link with the alias in it, e.g. https://masqq.vercel.app/c/night-owl-k7m2xq9p */
export function inviteUrl(call: { id: string; hostAlias: string }) {
  const slug = slugify(call.hostAlias);
  return `${env.APP_URL}/c/${slug ? `${slug}-` : ""}${call.id}`;
}

/** The call ID from an invite path segment. Call IDs never contain "-". */
export function callIdFromInvite(segment: string) {
  return segment.slice(segment.lastIndexOf("-") + 1);
}
