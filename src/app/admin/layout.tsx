import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/auth-buttons";
import { LogoMark } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const openReports = await db.report.count({ where: { status: "OPEN" } });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin" className="flex items-center gap-2">
          <LogoMark className="h-9 w-9" />
          <span className="text-lg font-semibold">masqq</span>
        </Link>
        <ModeSwitch current="admin" />
      </header>
      <AdminNav openReports={openReports} />
      <div className="mt-6">{children}</div>
      <footer className="mt-10 flex items-center justify-between gap-3 border-t border-neutral-900 pt-4 text-sm text-neutral-500">
        <span className="min-w-0 truncate">Signed in as {admin.email}</span>
        <SignOutButton />
      </footer>
    </div>
  );
}
