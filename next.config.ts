import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const https = (process.env.APP_URL ?? "").startsWith("https://");

/** The LiveKit server, as both its websocket and https origins. */
function livekitOrigins() {
  const url = process.env.LIVEKIT_URL;
  if (!url) return [];
  try {
    const u = new URL(url);
    const secure = u.protocol === "wss:" || u.protocol === "https:";
    return [`${secure ? "wss" : "ws"}://${u.host}`, `${secure ? "https" : "http"}://${u.host}`];
  } catch {
    return [];
  }
}

// Only masqq's own code runs, it only talks to masqq, LiveKit (calls) and R2
// (recordings), and no other site can frame it.
const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts to start the page; no outside scripts allowed.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  ["connect-src 'self'", ...livekitOrigins(), "https://*.livekit.cloud", "wss://*.livekit.cloud"].join(" "),
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Google sign-in posts a form that redirects to Google.
  "form-action 'self' https://accounts.google.com",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera, mic and screen sharing for masqq itself only; nothing else.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Always check for a new service worker.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
