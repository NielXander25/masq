import type { Plan, Role } from "@prisma/client";

// All plan gating lives here. Always pass a user loaded on the server.

export type Feature = "VOICE_CHANGER" | "UNLIMITED_PARTICIPANTS";

const FEATURES: Record<Plan, ReadonlySet<Feature>> = {
  FREE: new Set(),
  PRO: new Set(["VOICE_CHANGER", "UNLIMITED_PARTICIPANTS"]),
};

/** Max people in a call, host included. `null` means no limit. */
const MAX_PARTICIPANTS: Record<Plan, number | null> = {
  FREE: 2,
  PRO: null,
};

type PlanUser = { plan: Plan; role?: Role };

/** Admins get every feature, whatever their plan. */
export function canUse(feature: Feature, user: PlanUser) {
  return user.role === "ADMIN" || FEATURES[user.plan].has(feature);
}

export function maxParticipants(user: PlanUser) {
  return canUse("UNLIMITED_PARTICIPANTS", user) ? null : MAX_PARTICIPANTS[user.plan];
}
