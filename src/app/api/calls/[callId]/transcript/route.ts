import { db } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/api";

// Host only: the transcript as a .txt download.
export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const { callId } = await params;
  const call = await db.call.findFirst({
    where: { id: callId, hostId: user.id },
    select: { hostAlias: true, transcript: { select: { status: true, text: true } } },
  });
  if (!call || call.transcript?.status !== "DONE") return jsonError(404, "Not found");
  const name = `masqq-${call.hostAlias.replace(/[^\w-]+/g, "-")}-${callId}.txt`;
  return new Response(call.transcript.text ?? "", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
