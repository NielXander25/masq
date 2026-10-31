// Simple rate limits.
//
// `allow` is in memory: each server instance counts on its own, so it's a
// speed bump against floods, not an exact quota. Limits that must hold across
// instances (creating calls, asking to join) count rows in the database instead.

const hits = new Map<string, number[]>();

/** True if `key` has made fewer than `max` calls in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep memory bounded.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return true;
}

export const TOO_MANY = "Too many requests. Please wait a moment and try again.";
