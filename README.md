# Retrouve : localiser ses téléphones et appareils perdus

**Retrouve** sert à retrouver vos téléphones, tablettes et ordinateurs perdus ou volés, ainsi que ceux de votre famille. Le projet se compose de trois parties :

| Partie | Dossier | Technologie |
|---|---|---|
| Site web et API | `apps/web` | Next.js 15, PostgreSQL (Prisma), Tailwind, Leaflet et OpenStreetMap |
| Application mobile (Android) | `apps/mobile` | React Native Expo SDK 54, module natif Kotlin |
| Agent pour ordinateurs | `apps/desktop-agent` | Node.js, sans dépendance externe |
| Code partagé | `packages/shared` | Schémas zod et types communs |

## ⚠️ À savoir avant tout : l'IMEI

**Un IMEI seul ne permet pas de localiser un téléphone.** Seul l'opérateur mobile peut le faire, et uniquement sur demande de la police. Les sites qui promettent « localiser par IMEI » sont des arnaques.

Retrouve fonctionne comme « Localiser mon appareil » de Google :

1. vous installez l'application sur l'appareil **avant** de le perdre ;
2. l'application envoie régulièrement la position de l'appareil à **votre** serveur ;
3. en cas de perte, vous ouvrez le site pour voir où se trouve l'appareil et agir à distance.

L'IMEI sert à autre chose : il est enregistré dans la fiche de l'appareil et figure dans le **PDF de déclaration de perte ou de vol**. Avec ce document, la police et l'opérateur peuvent **bloquer le téléphone** (mise sur liste noire).

## Fonctionnalités

- **Carte** : dernière position, précision et trajet (de 1 h à 30 jours), plus les positions de tous vos appareils.
- **Faire sonner** : le téléphone sonne fort sur le canal « alarme » pendant 30 s, même en mode silencieux.
- **Localiser maintenant** : l'appareil envoie une position GPS précise sur demande.
- **Mode perdu** : votre message et votre numéro s'affichent en plein écran et dans une notification visible sur l'écran verrouillé. La position est envoyée chaque minute.
- **Verrouiller** et **effacer** à distance (Android, option « administrateur de l'appareil »). Votre mot de passe est redemandé avant chaque action.
- **Alertes** :
  - changement de carte SIM ou d'opérateur ;
  - batterie faible ;
  - sortie d'une zone ;
  - mauvais codes de déverrouillage (avec la position) ;
  - appareil hors ligne depuis plus de 24 h.
- **Dernière position avant extinction** : une position est envoyée quand la batterie descend sous 5 %.
- **Commandes par SMS sans internet** : envoyez `LOCATE 4821` au téléphone perdu, il répond par SMS avec un lien vers sa position. `RING 4821` le fait sonner.
- **Hors ligne** : les positions sont gardées sur le téléphone et envoyées quand le réseau revient.
- **Partage familial** : chaque appareil peut être partagé en « voir la position » ou « voir et envoyer des commandes ».
- **PDF de déclaration** pour la police et l'opérateur : propriétaire, IMEI, SIM, dernières positions et démarches à suivre.
- **Ordinateurs** : position approximative (adresse IP, ou position fixe pour un PC de bureau), sonnerie, verrouillage et message.
- **Vie privée** : les positions sont supprimées automatiquement après 30 jours, et l'application reste toujours visible sur l'appareil.
- **Alertes par email (Gmail) et notifications du navigateur**, envoyées au propriétaire et à la famille, sans spam (une seule notification par type toutes les 15 min).
- **Compte complet** : mot de passe oublié (lien par email), changement de mot de passe (déconnecte les autres sessions), suppression du compte et de toutes ses données.
- **Site installable (PWA)** : il s'ajoute à l'écran d'accueil comme une application, et affiche une page « hors ligne ».
- **Pages légales** (confidentialité, conditions d'utilisation) et pages d'erreur en français.

## 1. Lancer le site sur votre ordinateur

Prérequis : **Node.js 20 ou plus récent**, et **Docker** (ou une base PostgreSQL déjà installée).

```bash
git clone https://github.com/fisaoranatech-debug/Fist-Repo.git retrouve
cd retrouve
npm install

# Base de données
docker compose up -d

# Configuration
cp .env.example apps/web/.env      # ne gardez que la partie « Site web / API »
# Dans apps/web/.env, changez AUTH_SECRET (au moins 32 caractères aléatoires) :
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm run db:migrate                 # crée les tables
npm run dev                        # http://localhost:3000
```

Ouvrez ensuite http://localhost:3000, créez un compte, puis cliquez sur « Ajouter un appareil ».

### Tester sans téléphone

Le simulateur joue le rôle d'un téléphone qui se déplace dans Antananarivo et répond aux commandes :

```bash
npm run simulate -- --email votre@email.mg --password votremotdepasse
# ou, avec un code affiché sur le site :
npm run simulate -- --code 123456
```

## 2. Obtenir l'application Android (APK)

### Le plus simple : télécharger l'APK construit par GitHub

Rien à installer sur un ordinateur. À chaque modification de l'application, GitHub Actions (`.github/workflows/android-apk.yml`) construit l'APK et le publie ici :

**https://github.com/fisaoranatech-debug/Fist-Repo/releases/tag/android-latest**

1. Ouvrez ce lien **sur le téléphone** et touchez `retrouve.apk`.
2. Installez-le. Si Android le demande, autorisez « Installer des applications inconnues » pour le navigateur.
3. Pour une mise à jour, téléchargez simplement le nouvel APK et installez-le par-dessus : vos réglages sont conservés.

On peut aussi relancer une construction à la main : onglet **Actions → APK Android → Run workflow**.

**Mises à jour depuis l'application** : une fois cette version installée, plus besoin de revenir sur cette page.
- L'application vérifie les nouvelles versions à chaque ouverture, et toutes les 12 h en arrière-plan avec une notification.
- Touchez **« Mettre à jour »**, puis **« Installer »** quand Android le demande. Cette confirmation est obligatoire pour une application installée hors du Play Store.
- La première fois, autorisez Retrouve à « Installer des applications inconnues ».
- Le fichier téléchargé est vérifié (empreinte SHA-256 publiée dans `version.json`) avant l'installation.

> L'APK est signé avec la clé fixe du modèle Expo : c'est suffisant pour un usage familial, et les mises à jour s'installent par-dessus. Pour signer avec votre propre clé, ajoutez dans GitHub (Settings → Secrets and variables → Actions) `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`. Attention : changer de clé oblige à désinstaller l'ancienne version une fois.

### Autre possibilité : EAS Build (Expo), depuis un ordinateur

L'application utilise des fonctions natives (localisation en arrière-plan, administrateur de l'appareil, SMS). Elle ne fonctionne donc **pas dans Expo Go** : il faut construire un APK. **EAS Build**, le service de construction d'Expo, est gratuit avec un compte Expo. Prévoyez au moins 3 Go d'espace libre, et clonez le projet dans votre dossier personnel (pas dans `C:\Windows\System32`).

```bash
cd apps/mobile
npm install
npm install -g eas-cli
eas login                 # créez un compte gratuit sur expo.dev si besoin
eas init                  # crée le projet EAS et affiche son identifiant
```

1. Dans `apps/mobile/eas.json`, remplacez `https://VOTRE-SITE.vercel.app` par l'adresse de votre site. Pour un test local, mettez l'adresse IP de votre PC sur le Wi-Fi, par exemple `http://192.168.1.10:3000`.
2. Exportez l'identifiant du projet : `export EAS_PROJECT_ID=<id affiché par eas init>`.
3. Lancez la construction : `npm run build:apk`. Au bout d'environ 15 minutes, EAS donne un lien pour télécharger l'APK.

> **Notifications push (recommandé)** : grâce à elles, les commandes arrivent en quelques secondes. Sans elles, le téléphone les récupère à sa prochaine synchronisation, soit en 5 minutes au maximum (1 minute en mode perdu). Pour les activer :
> 1. créez un projet Firebase ;
> 2. ajoutez-y une application Android `mg.retrouve.app` ;
> 3. téléversez la clé FCM V1 avec `eas credentials` (guide : https://docs.expo.dev/push-notifications/fcm-credentials/).

### Sur le téléphone

1. Copiez l'APK sur le téléphone et installez-le (autorisez « sources inconnues »).
2. Ouvrez **Retrouve**, saisissez le code à 6 chiffres affiché sur le site et l'adresse du serveur.
3. Accordez les autorisations demandées :
   - **Localisation → « Toujours autoriser »** (indispensable) ;
   - **Notifications** ;
   - **Batterie → « Sans restriction »**. C'est très important sur Tecno, Infinix, itel, Xiaomi, Oppo et Samsung, qui arrêtent les applications en arrière-plan. Le site https://dontkillmyapp.com explique la manipulation pour chaque marque ;
   - **Administrateur de l'appareil** (facultatif) : verrouiller ou effacer à distance, alerte après de mauvais codes ;
   - **SMS** (facultatif) : commandes `LOCATE` et `RING` sans internet. Choisissez le code secret sur le site, dans la fiche de l'appareil.
4. Touchez **« Démarrer la protection »**. La notification « Retrouve protège cet appareil » reste affichée en permanence : c'est normal et obligatoire.

## 3. Mettre le site en ligne (gratuit) : Vercel + Neon

1. Créez une base PostgreSQL gratuite sur https://neon.tech et copiez son adresse de connexion (`postgresql://…?sslmode=require`).
2. Sur https://vercel.com, importez le dépôt GitHub, puis :
   - **Root Directory** : `apps/web` ;
   - **Variables d'environnement** :
     - `DATABASE_URL` : l'adresse Neon ;
     - `AUTH_SECRET` : une longue chaîne aléatoire ;
     - `APP_URL` : l'adresse du site ;
     - `CRON_SECRET` : une autre chaîne aléatoire ;
     - `EXPO_ACCESS_TOKEN` : facultatif.
3. Pour les emails : activez la validation en deux étapes sur votre compte Google, créez un **mot de passe d'application** (https://myaccount.google.com/apppasswords), puis ajoutez `SMTP_USER`, `SMTP_PASSWORD` et `MAIL_FROM` dans Vercel.
4. Pour les notifications du navigateur : `npx web-push generate-vapid-keys`, puis ajoutez `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT`.
5. Déployez. Le script `vercel-build` crée les tables automatiquement (`prisma migrate deploy`).
6. Les tâches planifiées de `apps/web/vercel.json` (nettoyage et détection hors ligne) s'activent toutes seules.

## 4. Agent pour ordinateurs

Prérequis : Node.js 18 ou plus récent sur l'ordinateur.

```bash
cd apps/desktop-agent
node src/cli.js pair 123456 --url https://votre-site.vercel.app
#   ajoutez --lat -18.91 --lng 47.52 pour un PC de bureau qui ne bouge pas
node src/cli.js once       # test
node src/cli.js install    # démarrage automatique (Windows, macOS, Linux)
```

Sans GPS, la position d'un ordinateur est **approximative** : elle est déduite de l'adresse IP et donne le quartier ou la ville.

## Tests

```bash
npm test                    # schémas partagés + API (41 tests sur une vraie base PostgreSQL « retrouve_test »)
npm run test:e2e            # parcours dans le navigateur, sur une version de production locale (Playwright, ordinateur + mobile)
npm run typecheck && npm run lint
cd apps/mobile && npm test && npm run typecheck     # application mobile
cd apps/desktop-agent && npm test                   # agent ordinateur
```

## Sécurité et vie privée

- Mots de passe hachés avec bcrypt, sessions JWT dans un cookie `httpOnly`, protection CSRF par vérification de l'origine.
- Chaque appareil possède un **jeton secret**, dont seule l'empreinte SHA-256 est stockée. Associer l'appareil à nouveau déconnecte l'ancien téléphone.
- Les tentatives de connexion et d'association sont limitées.
- Un utilisateur ne voit jamais les appareils des autres (réponse 404, pas même « accès refusé »).
- Verrouiller et effacer exigent votre mot de passe. Le PIN de verrouillage n'est jamais renvoyé au site.
- Les positions sont supprimées après 30 jours (variable `LOCATION_RETENTION_DAYS`).
- **Légalité** : n'installez Retrouve que sur vos appareils, ou sur ceux de proches qui sont d'accord. L'application est volontairement visible (icône et notification permanente). Suivre quelqu'un à son insu est illégal.
- En cas de vol, **ne tentez pas de récupérer l'appareil vous-même** chez un inconnu : transmettez la position et le PDF à la police.

## Limites connues (honnêtement)

- **iOS** : le code est en grande partie compatible, mais seul Android a été pensé et configuré. Sur iPhone, l'application « Localiser » d'Apple fait mieux, et iOS interdit le verrouillage, l'effacement et les SMS aux applications tierces.
- **Nouveau PIN au verrouillage** : il ne s'applique que jusqu'à Android 6. Les versions récentes interdisent aux applications de changer le code, donc l'écran se verrouille avec le code actuel.
- **Photo de l'intrus** : Android 9 et plus récents interdisent l'accès à la caméra en arrière-plan. Retrouve envoie donc une **alerte « mauvais codes » avec la position**, sans photo. Le serveur et le site savent toutefois déjà afficher une photo.
- **Effacement** : il dépend de la version d'Android et du fabricant. Si le téléphone le refuse, la commande apparaît « Échec » sur le site avec la raison.
- **Économie de batterie** : certains fabricants arrêtent les applications malgré tout. Voir https://dontkillmyapp.com.
- **Téléphone éteint ou réinitialisé** : plus aucune position n'est envoyée. Le PDF avec l'IMEI devient alors votre meilleur recours.
- **APK non vérifié dans ce dépôt** : le code Kotlin a été compilé contre le framework Android 14 et le bundle JavaScript se construit. Il faut cependant tester l'APK final sur un vrai téléphone.

## Structure

```
apps/web/                 site + API
  prisma/schema.prisma    base de données
  src/app/api/            routes (comptes, appareils, agent, alertes, tâches planifiées)
  src/app/(app)/          pages connectées
  src/lib/                authentification, commandes, PDF, push, zones…
  tests/  e2e/            tests Vitest et Playwright
apps/mobile/
  app/                    écrans (association, autorisations, accueil, mode perdu)
  src/                    synchronisation, file hors ligne, commandes, tâches en arrière-plan
  modules/retrouve-native module Kotlin (administrateur, alarme, SMS, mauvais codes)
apps/desktop-agent/       agent Node pour ordinateurs
packages/shared/          schémas et types communs
scripts/simulate-device.ts faux téléphone pour les tests
```
