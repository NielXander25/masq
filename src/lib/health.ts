import { RoomServiceClient } from "livekit-server-sdk";
import { env } from "@/env";
import { livekitConfig, livekitConfigured } from "@/lib/livekit";
import { r2BucketUrl, r2Configured } from "@/lib/r2";

export type Check = { name: string; status: "ok" | "error" | "missing"; detail: string };

const timeout = () => AbortSignal.timeout(6000);

async function check(name: string, configured: boolean, run: () => Promise<string>): Promise<Check> {
  if (!configured) return { name, status: "missing", detail: "Not configured" };
  try {
    return { name, status: "ok", detail: await run() };
  } catch (e) {
    return { name, status: "error", detail: (e as Error).message.slice(0, 160) };
  }
}

/** Live checks of each outside service, for the admin overview. */
export function checkIntegrations(): Promise<Check[]> {
  return Promise.all([
    check("LiveKit (calls)", livekitConfigured(), async () => {
      const { url, key, secret } = livekitConfig();
      const rooms = await new RoomServiceClient(url.replace(/^ws/, "http"), key, secret).listRooms();
      return `${rooms.length} active room${rooms.length === 1 ? "" : "s"}`;
    }),
    check("Cloudflare R2 (recordings)", r2Configured(), async () => {
      const res = await fetch(r2BucketUrl("HEAD"), { method: "HEAD", signal: timeout() });
      if (res.ok) return `Bucket "${env.R2_BUCKET}" reachable`;
      if (res.status === 404) throw new Error(`Bucket "${env.R2_BUCKET}" not found`);
      if (res.status === 403) throw new Error("Keys rejected (check the token's bucket access)");
      throw new Error(`HTTP ${res.status}`);
    }),
    check("Deepgram (transcription)", Boolean(env.DEEPGRAM_API_KEY), async () => {
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}` },
        signal: timeout(),
      });
      if (res.ok) return "Key accepted";
      throw new Error(res.status === 401 ? "Key rejected" : `HTTP ${res.status}`);
    }),
    check("Resend (email)", Boolean(env.RESEND_API_KEY), async () => {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        signal: timeout(),
      });
      if (res.ok) return "Key accepted";
      // A sending-only key can't list domains, but this reply means the key is real.
      const body = await res.text();
      if (res.status === 401 && body.includes("restricted_api_key")) return "Sending key accepted";
      throw new Error(res.status === 401 || res.status === 400 ? "Key rejected" : `HTTP ${res.status}`);
    }),
  ]);
}
