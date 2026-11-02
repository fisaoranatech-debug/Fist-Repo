import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "./Footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2 font-bold">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">◎</span> Retrouve
      </Link>
      <article className="surface mt-6 rounded-2xl p-6 sm:p-8 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 text-[15px]">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">Dernière mise à jour : {updated}</p>
        {children}
      </article>
      <Footer />
    </main>
  );
}

export function contactEmail(): string | null {
  return process.env.CONTACT_EMAIL || process.env.SMTP_USER || null;
}
