import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const openReports = await db.report.count({ where: { status: "OPEN" } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo className="text-lg" />
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-black">Admin</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          My dashboard
        </Link>
      </header>
      <AdminNav openReports={openReports} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
