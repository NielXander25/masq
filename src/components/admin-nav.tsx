"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/hosts", label: "Hosts" },
  { href: "/admin/calls", label: "Calls" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
              active ? "bg-white text-black" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
            }`}
          >
            {t.label}
            {t.href === "/admin/reports" && openReports > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">{openReports}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
