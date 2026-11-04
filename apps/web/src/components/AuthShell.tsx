import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Card } from "./ui";

/** Mise en page des petites pages publiques (mot de passe oublié, réinitialisation…). */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">◎</span> Retrouve
      </Link>
      <Card>
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="mt-5">{children}</div>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        <Link className="font-semibold text-brand-600" href="/connexion">← Retour à la connexion</Link>
      </p>
      <Footer />
    </main>
  );
}
