import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getSessionUser } from "@/lib/server-session";

const FEATURES = [
  { icon: "🗺️", title: "Position en direct", text: "Dernière position, précision et trajet des derniers jours sur une carte." },
  { icon: "🔊", title: "Faire sonner", text: "Le téléphone sonne fort pendant 30 secondes, même en mode silencieux." },
  { icon: "🔒", title: "Mode perdu", text: "Un message et votre numéro s'affichent sur l'écran de l'appareil." },
  { icon: "📶", title: "Alerte SIM", text: "Vous êtes prévenu si quelqu'un change la carte SIM ou l'opérateur." },
  { icon: "📄", title: "Déclaration avec IMEI", text: "PDF prêt pour la police et l'opérateur, pour bloquer le téléphone." },
  { icon: "👨‍👩‍👧", title: "Famille", text: "Partagez la position d'un appareil avec vos proches." },
];

export default async function Home() {
  if (await getSessionUser()) redirect("/appareils");
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">◎</span> Retrouve
        </div>
        <Link href="/connexion" className="text-sm font-semibold text-brand-600">Se connecter</Link>
      </header>

      <section className="mt-14 text-center sm:mt-20">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Retrouvez votre téléphone<br className="hidden sm:block" /> perdu ou volé
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          Installez l&apos;application Retrouve sur vos appareils et ceux de votre famille. En cas de perte, ouvrez ce site
          pour voir où ils sont et agir à distance.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/inscription" className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            Créer un compte gratuit
          </Link>
          <Link href="/connexion" className="surface rounded-xl px-6 py-3 font-semibold">J&apos;ai déjà un compte</Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="surface rounded-2xl p-5">
            <div className="text-2xl">{f.icon}</div>
            <h2 className="mt-2 font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="surface mt-12 rounded-2xl p-6">
        <h2 className="font-semibold">Comment ça marche ?</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Créez votre compte et ajoutez un appareil (nom, modèle, IMEI : tapez <b>*#06#</b> pour l&apos;afficher).</li>
          <li>Installez l&apos;application sur l&apos;appareil et saisissez le code à 6 chiffres affiché ici.</li>
          <li>L&apos;appareil envoie régulièrement sa position. En cas de perte, tout est sur ce site.</li>
        </ol>
        <p className="mt-4 text-xs text-muted">
          Important : un IMEI seul ne permet pas de localiser un téléphone. Seul l&apos;opérateur peut le faire, sur demande de la
          police. C&apos;est pourquoi l&apos;application doit être installée <b>avant</b> la perte. Elle reste visible sur
          l&apos;appareil : la localisation se fait toujours avec le consentement de son utilisateur.
        </p>
      </section>
      <Footer />
    </main>
  );
}
