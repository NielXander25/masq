import { db } from "@/lib/db";

export type AuditAction =
  | "VIEW_HOST_IDENTITY"
  | "VIEW_RECORDING"
  | "VIEW_TRANSCRIPT"
  | "BAN_USER"
  | "UNBAN_USER"
  | "CHANGE_PLAN"
  | "UPDATE_REPORT";

export function audit(actorId: string, action: AuditAction, targetType: string, targetId: string) {
  return db.auditLog.create({ data: { actorId, action, targetType, targetId } });
}
