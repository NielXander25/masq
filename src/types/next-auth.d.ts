import type { Plan, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      plan: Plan;
      banned: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    plan: Plan;
    bannedAt: Date | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    plan: Plan;
    bannedAt: Date | null;
  }
}
