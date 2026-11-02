"use client";

/** Dernier filet de sécurité : remplace toute la page si la mise en page elle-même plante. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f6f7fb", color: "#141824" }}>
        <main style={{ textAlign: "center", padding: 16, maxWidth: 420 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 24 }}>Retrouve est momentanément indisponible</h1>
          <p style={{ color: "#5c6475" }}>Réessayez dans quelques instants.</p>
          <button onClick={reset} style={{ background: "#2453e6", color: "#fff", border: 0, borderRadius: 12, padding: "10px 20px", fontWeight: 600, fontSize: 15 }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
