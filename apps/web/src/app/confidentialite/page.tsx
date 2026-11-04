import { contactEmail, LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <LegalPage title="Politique de confidentialité" updated="2 novembre 2026">
      <p>
        Retrouve sert à localiser vos appareils perdus ou volés. Cette page explique quelles données sont collectées,
        pourquoi, combien de temps elles sont gardées et quels sont vos droits.
      </p>

      <h2>1. Données collectées</h2>
      <ul>
        <li><b>Votre compte</b> : nom, adresse email, mot de passe (stocké uniquement sous forme chiffrée irréversible), numéro de contact facultatif.</li>
        <li><b>Vos appareils</b> : nom, type, marque et modèle, IMEI et numéro de carte SIM si vous les renseignez, version du système.</li>
        <li><b>Positions</b> envoyées par l&apos;application installée sur l&apos;appareil : coordonnées GPS, précision, date, niveau de batterie.</li>
        <li><b>État de l&apos;appareil</b> : batterie, opérateur mobile (code pays et réseau), dernière connexion.</li>
        <li><b>Alertes</b> : changement de carte SIM, sortie de zone, mauvais codes de déverrouillage, appareil hors ligne.</li>
        <li><b>Données techniques</b> : adresse IP (limitation des tentatives de connexion), abonnements aux notifications du navigateur.</li>
      </ul>

      <h2>2. Pourquoi ces données</h2>
      <p>
        Uniquement pour vous permettre de retrouver vos appareils, de les protéger (sonnerie, mode perdu, verrouillage,
        effacement), de vous prévenir en cas d&apos;alerte et de produire le document de déclaration de perte ou de vol.
        Aucune donnée n&apos;est vendue, louée ni utilisée pour de la publicité.
      </p>

      <h2>3. Consentement</h2>
      <p>
        L&apos;application Retrouve est toujours visible sur l&apos;appareil (icône et notification permanente). Elle ne doit être
        installée que sur vos propres appareils, ou sur ceux de personnes qui ont donné leur accord (par exemple les membres de
        votre famille). Localiser une personne à son insu est interdit.
      </p>

      <h2>4. Durée de conservation</h2>
      <ul>
        <li>Positions : <b>30 jours</b>, puis suppression automatique.</li>
        <li>Alertes : 90 jours. Historique des commandes : 60 jours.</li>
        <li>Compte et appareils : jusqu&apos;à ce que vous les supprimiez.</li>
        <li>Liens de réinitialisation du mot de passe : 1 heure.</li>
      </ul>

      <h2>5. Qui peut voir vos données</h2>
      <p>
        Vous seul, ainsi que les personnes avec qui vous partagez explicitement un appareil (partage familial), que vous pouvez
        retirer à tout moment. Les données sont hébergées chez nos prestataires techniques (hébergement du site et de la base de
        données, envoi des emails et des notifications), qui n&apos;y accèdent que pour faire fonctionner le service.
      </p>
      <p>
        Si vous transmettez vous-même le PDF de déclaration ou une position à la police ou à votre opérateur, ces données sont
        alors utilisées par eux selon leurs propres règles.
      </p>

      <h2>6. Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe hachés, jeton secret propre à chaque appareil, limitation des tentatives,
        confirmation par mot de passe pour les actions sensibles.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément aux lois applicables sur la protection des données personnelles (notamment la loi malgache n° 2014-038
        sur la protection des données à caractère personnel), vous pouvez accéder à vos données, les corriger et les supprimer.
        Vous pouvez modifier votre profil et vos appareils à tout moment, et <b>supprimer votre compte</b> depuis
        Paramètres : toutes vos données sont alors effacées définitivement.
      </p>
      {email && (
        <p>
          Pour toute question : <a className="font-medium text-brand-600 underline" href={`mailto:${email}`}>{email}</a>.
        </p>
      )}
    </LegalPage>
  );
}
