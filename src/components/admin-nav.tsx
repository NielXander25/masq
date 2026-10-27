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
    <nav aria-label="Admin sections" className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-1">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
              active ? "bg-white font-medium text-black" : "bg-neutral-900 text-neutral-300 hover:text-white sm:bg-transparent"
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
