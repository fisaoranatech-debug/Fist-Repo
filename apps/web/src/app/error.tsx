"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted">Le problème a été enregistré. Réessayez dans un instant.</p>
      {error.digest && <p className="font-mono text-xs text-muted">Référence : {error.digest}</p>}
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">Réessayer</button>
        <Link href="/appareils" className="surface rounded-xl px-5 py-2.5 font-semibold">Mes appareils</Link>
      </div>
    </main>
  );
}
