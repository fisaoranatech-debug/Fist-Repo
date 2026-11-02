import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-muted">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link href="/appareils" className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">Mes appareils</Link>
    </main>
  );
}
