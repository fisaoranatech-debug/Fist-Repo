import { contactEmail, LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Conditions d'utilisation" };

export default function TermsPage() {
  const email = contactEmail();
  return (
    <LegalPage title="Conditions d'utilisation" updated="2 novembre 2026">
      <p>En créant un compte Retrouve, vous acceptez les conditions suivantes.</p>

      <h2>1. Le service</h2>
      <p>
        Retrouve permet d&apos;afficher la position d&apos;appareils sur lesquels l&apos;application Retrouve a été installée et
        associée à votre compte, et de leur envoyer des commandes (sonnerie, mode perdu, verrouillage, effacement). Un IMEI seul
        ne permet pas de localiser un appareil : l&apos;application doit être installée avant la perte.
      </p>

      <h2>2. Usage autorisé</h2>
      <ul>
        <li>Vous n&apos;associez que des appareils qui vous appartiennent, ou dont l&apos;utilisateur a donné son accord.</li>
        <li>Il est strictement interdit d&apos;utiliser Retrouve pour surveiller une personne à son insu, la harceler ou la suivre.</li>
        <li>Vous êtes responsable de la confidentialité de votre mot de passe et des actions faites depuis votre compte.</li>
      </ul>
      <p>Tout usage abusif peut entraîner la suppression du compte, sans préjudice d&apos;éventuelles poursuites.</p>

      <h2>3. En cas de vol</h2>
      <p>
        Ne tentez pas de récupérer vous-même un appareil volé chez un inconnu. Transmettez la position et le document de
        déclaration à la police ou à la gendarmerie, et contactez votre opérateur pour bloquer la carte SIM et l&apos;IMEI.
      </p>

      <h2>4. Commandes à distance</h2>
      <p>
        L&apos;effacement à distance est irréversible : l&apos;appareil revient aux réglages d&apos;usine et ne peut plus être localisé.
        Le verrouillage et l&apos;effacement dépendent des autorisations accordées sur l&apos;appareil et de sa version d&apos;Android.
      </p>

      <h2>5. Limites du service</h2>
      <p>
        Retrouve ne peut pas garantir de retrouver un appareil. La localisation dépend du GPS, du réseau, de la batterie, des
        réglages d&apos;économie d&apos;énergie du fabricant et du fait que l&apos;appareil soit allumé. Un appareil éteint, réinitialisé
        ou sans réseau ne transmet plus sa position. Le service est fourni « en l&apos;état », sans garantie de disponibilité continue.
      </p>

      <h2>6. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la <a className="font-medium text-brand-600 underline" href="/confidentialite">politique de confidentialité</a>.
        Vous pouvez supprimer votre compte à tout moment depuis Paramètres.
      </p>

      <h2>7. Modifications</h2>
      <p>Ces conditions peuvent évoluer. En cas de changement important, vous en serez informé sur le site ou par email.</p>
      {email && (
        <p>
          Contact : <a className="font-medium text-brand-600 underline" href={`mailto:${email}`}>{email}</a>.
        </p>
      )}
    </LegalPage>
  );
}
