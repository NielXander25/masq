"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { aliasSchema, hostTitleSchema } from "@/lib/alias";
import { randomId, shortCode } from "@/lib/ids";
import { canUse } from "@/lib/plans";
import { recordingConfigured } from "@/lib/recording";
import { requireUser } from "@/lib/session";
import { VOICE_PRESETS } from "@/lib/voice/presets";

const createCallSchema = z
  .object({
    alias: aliasSchema,
    hostTitle: hostTitleSchema,
    voiceChangerEnabled: z.boolean(),
    voicePreset: z.enum(VOICE_PRESETS).optional(),
    recordingEnabled: z.boolean(),
    guestCamera: z.enum(["OPTIONAL", "REQUIRED"]),
  })
  .refine((v) => !v.voiceChangerEnabled || v.voicePreset, {
    path: ["voicePreset"],
    message: "Pick a voice preset",
  });

export type CreateCallState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createCall(
  _prev: CreateCallState,
  formData: FormData,
): Promise<CreateCallState> {
  const sessionUser = await requireUser("/dashboard");
  // Plan comes from the database, never from the client.
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { id: true, plan: true, role: true },
  });

  const parsed = createCallSchema.safeParse({
    alias: formData.get("alias"),
    hostTitle: formData.get("hostTitle") ?? "",
    voiceChangerEnabled: formData.get("voiceChangerEnabled") === "on",
    voicePreset: formData.get("voicePreset") || undefined,
    recordingEnabled: formData.get("recordingEnabled") === "on",
    guestCamera: formData.get("guestCamera") ?? "OPTIONAL",
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  if (input.recordingEnabled && !recordingConfigured()) {
    return { error: "Recording isn't available yet." };
  }

  if (input.voiceChangerEnabled && !canUse("VOICE_CHANGER", user)) {
    return { error: "The voice changer is a PRO feature." };
  }

  const call = await db.call.create({
    data: {
      // Short ID so invite links stay short: /c/k7m2xq9p
      id: shortCode(),
      hostId: user.id,
      hostAlias: input.alias,
      hostTitle: input.hostTitle,
      roomName: randomId("room", 12),
      voiceChangerEnabled: input.voiceChangerEnabled,
      voicePreset: input.voiceChangerEnabled ? input.voicePreset : null,
      recordingEnabled: input.recordingEnabled,
      guestCamera: input.guestCamera,
      participants: {
        create: {
          userId: user.id,
          isHost: true,
          livekitIdentity: randomId("host"),
          status: "ADMITTED",
        },
      },
    },
    select: { id: true },
  });

  redirect(`/call/${call.id}`);
}
