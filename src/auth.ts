import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await db.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { bannedAt: true },
      });
      if (existing?.bannedAt) return "/suspended";
      return true;
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.plan = user.plan;
      session.user.banned = user.bannedAt != null;
      return session;
    },
  },
  events: {
    // Runs after the adapter has created or linked the user.
    async signIn({ user, profile }) {
      if (!user.id || !user.email) return;
      const isAdmin = env.ADMIN_EMAILS.includes(user.email.toLowerCase());
      await db.user.update({
        where: { id: user.id },
        data: {
          lastSeenAt: new Date(),
          // Keep name and avatar in sync with the Google profile.
          ...(profile?.name ? { name: profile.name } : {}),
          ...(typeof profile?.picture === "string" ? { image: profile.picture } : {}),
          ...(isAdmin ? { role: "ADMIN" } : {}),
        },
      });
    },
  },
});
