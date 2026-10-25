import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Host voice and video calls under any name. Every guest is identified.";

export const metadata: Metadata = {
  // Absolute URLs for link previews (WhatsApp, iMessage, Slack, …).
  metadataBase: new URL(env.APP_URL),
  title: { default: "masqq", template: "%s · masqq" },
  description,
  openGraph: { siteName: "masqq", title: "masqq", description, type: "website" },
  twitter: { card: "summary_large_image", title: "masqq", description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
