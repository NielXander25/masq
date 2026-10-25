import { env } from "@/env";

/** Sends through Resend's HTTP API. Returns false (and logs) if it can't send. */
export async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; email not sent:", subject);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "masqq <onboarding@resend.dev>", to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error("Resend failed", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

export function recordingReadyEmail(alias: string, url: string) {
  const safe = alias.replace(/[<>&"]/g, "");
  return {
    subject: `Your masqq recording is ready: ${safe}`,
    text: `The recording and transcript of your call as "${safe}" are ready.\n\n${url}\n\nThe link opens your masqq dashboard.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px">
<h2 style="margin:0 0 12px">Your recording is ready</h2>
<p>The recording and transcript of your call as <b>${safe}</b> are ready.</p>
<p><a href="${url}" style="display:inline-block;background:#000;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open recording</a></p>
<p style="color:#666;font-size:13px">masqq</p></div>`,
  };
}
