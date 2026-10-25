"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const id = z.string().min(1).max(64);

/** Reveal the real account behind a call's alias. Always audit-logged. */
export async function revealHost(input: unknown) {
  const admin = await requireAdmin();
  const { callId } = z.object({ callId: id }).parse(input);
  const call = await db.call.findUnique({
    where: { id: callId },
    select: { host: { select: { id: true, name: true, email: true } } },
  });
  if (!call) throw new Error("Call not found");
  await audit(admin.id, "VIEW_HOST_IDENTITY", "Call", callId);
  revalidatePath("/admin/audit");
  return call.host;
}

export async function setBanned(input: unknown) {
  const admin = await requireAdmin();
  const { userId, banned } = z.object({ userId: id, banned: z.boolean() }).parse(input);
  if (userId === admin.id) throw new Error("You can't ban yourself");
  // Sessions are kept so the user's next visit can show the suspended page;
  // middleware then signs them out, and APIs refuse banned users immediately.
  await db.user.update({ where: { id: userId }, data: { bannedAt: banned ? new Date() : null } });
  await audit(admin.id, banned ? "BAN_USER" : "UNBAN_USER", "User", userId);
  revalidatePath("/admin", "layout");
}

export async function setPlan(input: unknown) {
  const admin = await requireAdmin();
  const { userId, plan } = z.object({ userId: id, plan: z.enum(["FREE", "PRO"]) }).parse(input);
  await db.user.update({ where: { id: userId }, data: { plan } });
  await audit(admin.id, "CHANGE_PLAN", "User", userId);
  revalidatePath("/admin", "layout");
}

export async function setReportStatus(formData: FormData) {
  const admin = await requireAdmin();
  const { reportId, status } = z
    .object({ reportId: id, status: z.enum(["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"]) })
    .parse({ reportId: formData.get("reportId"), status: formData.get("status") });
  await db.report.update({ where: { id: reportId }, data: { status } });
  await audit(admin.id, "UPDATE_REPORT", "Report", reportId);
  revalidatePath("/admin", "layout");
}
