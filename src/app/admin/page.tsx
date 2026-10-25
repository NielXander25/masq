import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminPage() {
  await requireAdmin();
  const [users, calls] = await Promise.all([db.user.count(), db.call.count()]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          Dashboard
        </Link>
      </header>
      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 p-4">
          <dt className="text-sm text-neutral-400">Users</dt>
          <dd className="mt-1 text-3xl font-semibold">{users}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 p-4">
          <dt className="text-sm text-neutral-400">Calls</dt>
          <dd className="mt-1 text-3xl font-semibold">{calls}</dd>
        </div>
      </dl>
      <p className="mt-8 text-sm text-neutral-500">The full admin dashboard arrives in Phase 5.</p>
    </main>
  );
}
