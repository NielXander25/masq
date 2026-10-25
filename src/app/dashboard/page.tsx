import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {user.role === "ADMIN" && (
            <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <p className="mt-6 text-neutral-400">
        Signed in as <span className="text-white">{user.email}</span> · {user.plan} plan
      </p>
      <p className="mt-8 rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
        Calls arrive in Phase 2.
      </p>
    </main>
  );
}
