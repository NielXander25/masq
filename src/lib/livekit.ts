import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { env } from "@/env";

export const TOKEN_TTL_SECONDS = 2 * 60 * 60;

export function livekitConfig() {
  return config();
}

function config() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  return { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET };
}

export function livekitConfigured() {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

export function livekitServerUrl() {
  return config().url;
}

type TokenInput =
  | { kind: "host"; roomName: string; identity: string; alias: string }
  | { kind: "guest"; roomName: string; identity: string; name: string; email: string };

/**
 * Short-lived token scoped to one room. The host token carries only the random
 * identity and the alias: never anything tied to the host's account.
 */
export async function createToken(input: TokenInput) {
  const { key, secret } = config();
  const at =
    input.kind === "host"
      ? new AccessToken(key, secret, {
          identity: input.identity,
          name: input.alias,
          ttl: TOKEN_TTL_SECONDS,
        })
      : new AccessToken(key, secret, {
          identity: input.identity,
          name: input.name,
          metadata: JSON.stringify({ email: input.email }),
          ttl: TOKEN_TTL_SECONDS,
        });

  at.addGrant({
    room: input.roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
    // The host is audio-only so their face can never be published.
    ...(input.kind === "host" ? { canPublishSources: [TrackSource.MICROPHONE] } : {}),
  });

  return at.toJwt();
}

export async function deleteRoom(roomName: string) {
  const { url, key, secret } = config();
  const client = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  try {
    await client.deleteRoom(roomName);
  } catch {
    // The room may not exist yet (nobody connected) or was already closed.
  }
}
