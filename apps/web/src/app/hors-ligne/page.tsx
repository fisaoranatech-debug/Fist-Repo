export const metadata = { title: "Hors ligne" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-2xl font-bold">Pas de connexion</h1>
      <p className="text-muted">
        Retrouve a besoin d&apos;internet pour afficher la position de vos appareils. Vérifiez le Wi-Fi ou les données mobiles,
        puis réessayez.
      </p>
      {/* Rechargement complet volontaire : on retente vraiment le réseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/appareils" className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">Réessayer</a>
    </main>
  );
}
