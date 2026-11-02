import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-app py-6 text-center text-xs text-muted">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/confidentialite" className="hover:underline">Confidentialité</Link>
        <Link href="/conditions" className="hover:underline">Conditions d&apos;utilisation</Link>
        <Link href="/" className="hover:underline">Accueil</Link>
      </nav>
      <p className="mt-2">© {new Date().getFullYear()} Retrouve · Localiser ses appareils, avec le consentement de leurs utilisateurs.</p>
    </footer>
  );
}
