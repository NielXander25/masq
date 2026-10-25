import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Server-side guards. Middleware also checks these routes, but every page and
// action must re-check on its own: never rely on middleware alone.

export async function requireUser(callbackUrl = "/dashboard") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (session.user.banned) redirect("/suspended");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
