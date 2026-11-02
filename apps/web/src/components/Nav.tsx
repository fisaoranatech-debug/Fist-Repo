"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import type { AlertDTO } from "@retrouve/shared";
import { fetcher } from "@/lib/api-client";
import { cx } from "./ui";

const LINKS = [
  { href: "/appareils", label: "Appareils", icon: "📱" },
  { href: "/alertes", label: "Alertes", icon: "🔔" },
  { href: "/parametres", label: "Paramètres", icon: "⚙️" },
];

export function Nav({ userName }: { userName: string }) {
  const path = usePathname();
  const { data: unread } = useSWR<AlertDTO[]>("/api/alerts?unread=1", fetcher, { refreshInterval: 30_000 });
  const count = unread?.length ?? 0;
  return (
    <header className="sticky top-0 z-[1000] border-b border-app bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/appareils" className="mr-2 flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">◎</span>
          <span className="hidden sm:inline">Retrouve</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-label={l.href === "/alertes" && count > 0 ? `${l.label} (${count} non lues)` : l.label}
                className={cx(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand-500/10 text-brand-600 dark:text-brand-100" : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                <span aria-hidden>{l.icon}</span>
                <span className="hidden sm:inline">{l.label}</span>
                {l.href === "/alertes" && count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <span className="hidden text-sm text-muted md:inline">{userName}</span>
      </div>
    </header>
  );
}
