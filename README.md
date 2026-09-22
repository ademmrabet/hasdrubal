# Hasdrubal de Carthage

Systeme de gestion pour le restaurant **Hasdrubal de Carthage** : stock, menu,
reservations, clients, personnel, paie, factures, TVA, previsions et tableaux
de bord.

V75X+6X Carthage (La Percee Verte) · +216 90 177 773 · ferme le dimanche

## Stack

- **Front end** : React 19 + Vite, React Router, TanStack Query, Tailwind CSS v4, GSAP
- **Back end** : Node.js + Express 5, PostgreSQL
- **Auth** : JWT (access + refresh), trois roles : `owner`, `manager`, `staff`

Deux interfaces distinctes selon le role : **Admin** (owner / manager) et **Staff**.

## Demarrage

```bash
# 1. Prerequis : Node 20+, PostgreSQL 14+
createdb hasdrubal

# 2. Configuration
cp server/.env.example server/.env    # puis renseigner DATABASE_URL et les secrets

# 3. Installation, schema et donnees de demonstration
npm install
npm run migrate
npm run seed

# 4. Lancement (API sur :4000, front sur :5173)
npm run dev
```

Le menu public (celui du QR code) est sur `http://localhost:5173/menu`, sans connexion.
Les photos des plats sont stockées dans `server/uploads/` (ignoré par git).

`npm run seed` charge la **vraie carte** de Hasdrubal (60 plats, 10 categories, prix de la
carte papier) avec des ingredients et un historique de stock fictifs. Attention : il
**efface** la base avant de la remplir.

Comptes de demonstration crees par `npm run seed` :

| Role | Email | Mot de passe |
|---|---|---|
| Owner | `owner@hasdrubal.tn` | `Hasdrubal2026!` |
| Manager | `manager@hasdrubal.tn` | `Hasdrubal2026!` |
| Staff | `staff@hasdrubal.tn` | `Hasdrubal2026!` |

## Importer la carte sans rien effacer

`npm run import:menu` ajoute la carte de Hasdrubal (`server/seeds/data/carte-hasdrubal.js`)
a une base existante, y compris en production. Il ne modifie jamais un plat deja present.

```bash
npm run import:menu -- --dry-run     # simulation : montre ce qui serait cree, n'ecrit rien
npm run import:menu                  # cree les categories et plats manquants
npm run import:menu -- --sync        # realigne aussi prix, description, allergenes et ordre
                                     # des plats existants (fiches, photos, TVA, disponibilite intactes)
docker compose exec server node seeds/import-menu.js     # meme chose dans Docker
```

A savoir avant d'imprimer le QR code :

- Deux plats n'ont pas de prix lisible (Toast poulpe avocat, Filet de Saint Pierre) : ils sont
  crees **inactifs**, donc absents du menu public, jusqu'a la saisie du prix dans l'application.
- Les **allergenes sont deduits** des ingredients affiches (la carte papier n'en indique pas).
  La cuisine doit les relire, plat par plat, dans La carte > Modifier.
- Les fiches techniques (cout matiere, marges) sont a saisir avec les vraies recettes. Le seed de
  demonstration en fournit dix, indicatives, pour montrer les calculs.
- Le taux de TVA applique aux plats vient des parametres du restaurant (19 % par defaut) :
  a confirmer avec le comptable, puis a corriger si besoin.

## Developpement avec rechargement a chaud

Deux facons, au choix. Dans les deux cas, sauvegarder un fichier suffit : l'interface
se met a jour sans recharger la page (Vite HMR) et l'API redemarre seule (nodemon).

**Tout dans Docker** (rien a installer a part Docker Desktop) :

```bash
docker compose -f docker-compose.dev.yml up --build
# interface http://localhost:5173 · API http://localhost:4000 · Postgres localhost:5433
docker compose -f docker-compose.dev.yml exec api npm run seed --workspace server   # donnees de demo
```

Apres un changement de dependances (`package.json`) : `docker compose -f docker-compose.dev.yml up --build -V`.

**Node sur la machine, Postgres dans Docker** (plus rapide sous Windows) :

```bash
docker compose -f docker-compose.dev.yml up -d db
npm install
npm run dev        # server/.env : DATABASE_URL=postgresql://hasdrubal:hasdrubal@localhost:5433/hasdrubal
```

## Tester avant de pousser

A lancer dans cet ordre avant chaque `git push`. La CI GitHub rejoue les memes
etapes, mais les faire en local evite d'attendre son verdict.

```bash
# 0. Postgres de developpement demarre (une fois par session)
docker compose -f docker-compose.dev.yml up -d db

# 1. Dependances a jour et identiques a la CI
npm ci

# 2. Tests de l'API (124 verifications) sur la base hasdrubal_test, creee si besoin
npm test
#    une seule suite :  npm test --workspace server -- menu

# 3. Compilation du front (verifie aussi la generation du service worker)
npm run build

# 4. Les images de production se construisent et demarrent
docker compose up -d --build
docker compose ps                  # server et web doivent etre "healthy"
curl http://localhost:8080/api/health
#    ouvrir http://localhost:8080 et http://localhost:8080/menu, se connecter, verifier
docker compose down

# 5. Si tout est vert
git add -A
git commit -m "..."
git push
```

Raccourci pour les etapes 2 et 3 : `npm run check`.

Les tests **effacent** la base qu'ils utilisent. Le lanceur refuse toute base dont le
nom ne contient pas `test`. Pour en viser une autre :
`TEST_DATABASE_URL=postgresql://user:mdp@hote:5432/ma_base_test npm test`
(PowerShell : `$env:TEST_DATABASE_URL="postgresql://..."; npm test`).

## Mises a jour automatiques

| Quoi | Comment | Quand |
|---|---|---|
| Dependances npm, images Docker, actions GitHub | Dependabot ouvre des pull requests, la CI les teste, vous fusionnez | chaque lundi |
| Images publiees | la CI construit et pousse `ghcr.io/ademmrabet/hasdrubal-server` et `-web` a chaque push sur `main` | a chaque push |
| Serveur de production | Watchtower (`docker-compose.prod.yml`) recupere les nouvelles images et redemarre `server` et `web` | chaque nuit a 4 h |
| Tablettes et telephones | l'application (PWA) detecte la nouvelle version et l'installe quand l'ecran passe en arriere-plan, apres 5 min d'inactivite, ou sur un toucher | verification chaque heure |

Mise en production avec mises a jour automatiques :

```bash
docker login ghcr.io              # utilisateur GitHub + jeton avec le droit read:packages
docker compose -f docker-compose.prod.yml up -d
```

Precautions :

- Watchtower applique les nouvelles images **sans relecture** et l'API joue ses migrations
  au demarrage : programmer une sauvegarde de la base avant 4 h
  (`docker compose -f docker-compose.prod.yml exec -T db pg_dump -U hasdrubal hasdrubal > sauvegarde.sql`).
- Pour figer une version, mettre `IMAGE_TAG=sha-<commit>` dans `.env`.
- La base n'est jamais mise a jour par Watchtower.
- La mise a jour automatique des tablettes demande HTTPS (ou `localhost`) : un navigateur
  n'active pas de service worker sur `http://192.168.x.x`. Sans HTTPS, l'application reste
  a jour a chaque rechargement de page, rien de plus.

## Deploiement avec Docker

Il existe trois fichiers `Dockerfile` dans ce depot, pour deux usages differents :

- `server/Dockerfile` et `client/Dockerfile` — deploiement auto-heberge a deux
  conteneurs, decrit ci-dessous (`docker-compose.yml` / `docker-compose.prod.yml`).
- `Dockerfile` a la racine — image combinee client+API en un seul conteneur,
  pour Render (voir "Deploiement sur Render" plus bas). Les deux coexistent
  sans se géner : modifier l'un ne casse pas l'autre.

Trois conteneurs pour l'auto-hebergement : `db` (PostgreSQL 16), `server` (API)
et `web` (nginx, qui sert l'interface et relaie `/api` et `/uploads` vers
l'API). Seul `web` est expose.

```bash
cp .env.docker.example .env        # puis renseigner mot de passe et secrets
docker compose up -d --build       # construit et demarre ; les migrations s'appliquent seules
docker compose exec server node seeds/seed.js   # optionnel : donnees de demonstration
```

L'application repond sur `http://localhost:8080` (port reglable via `HTTP_PORT`),
le menu public sur `http://localhost:8080/menu`. Depuis une tablette du restaurant,
remplacer `localhost` par l'adresse IP de la machine.

Attention : `node seeds/seed.js` **efface** les donnees existantes. A ne jamais lancer
une fois le restaurant en exploitation.

| Besoin | Commande |
|---|---|
| Etat des conteneurs | `docker compose ps` |
| Journaux de l'API | `docker compose logs -f server` |
| Mise a jour apres modification du code | `docker compose up -d --build` |
| Arret | `docker compose down` (les donnees sont conservees) |
| Sauvegarde de la base | `docker compose exec -T db pg_dump -U hasdrubal hasdrubal > sauvegarde.sql` |
| Restauration | `docker compose exec -T db psql -U hasdrubal hasdrubal < sauvegarde.sql` |
| Sauvegarde des photos | `docker compose cp server:/app/server/uploads ./uploads-sauvegarde` |

Les donnees vivent dans deux volumes Docker, `pgdata` et `uploads`.
`docker compose down -v` les **supprime** definitivement.

**HTTPS.** Tant que l'application est servie en HTTP sur le reseau local, garder
`COOKIE_SECURE=false`. Pour une mise en ligne, placer un reverse proxy HTTPS
(Caddy, Traefik, ou le proxy de l'hebergeur) devant le conteneur `web`, puis passer
`COOKIE_SECURE=true` et `PUBLIC_URL=https://...`. L'adresse du menu QR se regle
ensuite dans l'application, page Menu QR.

## Déploiement sur Render (gratuit, sans carte bancaire)

Alternative à l'auto-hébergement Docker ci-dessus : un service Web Render
**unique**, construit depuis le `Dockerfile` à la racine du dépôt (client et
API dans le même conteneur — le plan gratuit de Render ne déploie qu'un seul
conteneur par service, contrairement au `server`+`web` à deux conteneurs
ci-dessus). Le serveur Express sert alors directement les fichiers compilés
du client en plus de l'API (voir `server/src/app.js`, `SERVE_CLIENT`) ; le
déploiement Docker à deux conteneurs plus haut n'est pas affecté par ce
changement. La base reste Neon (déjà configurée, gratuite, sans carte).

```bash
# 1. Pousser le code sur GitHub (si ce n'est pas déjà fait)
git push origin main

# 2. Sur render.com : New > Blueprint > sélectionner ce dépôt.
#    Render lit render.yaml et propose la configuration ci-dessous ;
#    vérifier puis cliquer "Apply" (rien n'est créé avant ce clic).
```

Variables à renseigner à la main dans le tableau de bord Render une fois le
service créé (jamais dans `render.yaml`, versionné et potentiellement
public) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | La chaîne de connexion Neon (`postgresql://...neon.tech/neondb?sslmode=require`) |
| `CLIENT_ORIGIN` | `https://<nom-du-service>.onrender.com` — connue seulement après le premier déploiement : redéployer une fois l'URL réelle en main |

`JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` sont générés automatiquement par
Render (`generateValue: true` dans `render.yaml`). Les migrations
s'appliquent seules au démarrage (`RUN_MIGRATIONS=true`), comme avec Docker.

**À régler avant de considérer le restaurant « en ligne » :**

- **Mot de passe Neon.** S'il a été partagé en clair à un moment (dans un
  message, un fichier `.env` envoyé...), le considérer compromis : le
  régénérer dans la console Neon (Roles → Reset password) et mettre à jour
  `DATABASE_URL` partout (Render, `.env` local) avant d'ouvrir l'accès au
  public.
- **Comptes de démonstration.** Le seed crée `owner@hasdrubal.tn` /
  `Hasdrubal2026!` (et les comptes manager/staff) avec un mot de passe
  visible dans le dépôt. À remplacer par un vrai compte (page Utilisateurs)
  avant tout usage réel : sinon n'importe qui connaissant ce mot de passe se
  connecte en tant que propriétaire.
- **Photos de plats non persistantes.** Le plan gratuit de Render n'offre
  pas de disque persistant : toute photo téléversée (`server/uploads`)
  disparaît au déploiement suivant. Tant que cette limite n'est pas levée
  (stockage objet externe type Cloudflare R2, avec un palier gratuit sans
  carte bancaire, ou disque payant Render), réserver les photos de plats à
  la démonstration plutôt qu'à une exploitation réelle.
- **Mise en veille.** Un service gratuit Render s'endort après ~15 min sans
  requête et met 30 à 50 secondes à se réveiller sur la requête suivante :
  le premier client de la journée peut voir un chargement lent. Le plan
  payant (à partir de 7 $/mois) supprime cette veille, le jour où cela
  devient gênant.

## Avancement

- [x] **Phase 1** — Fondations, authentification, RBAC, deux interfaces, module Stock
- [x] **Phase 2** — Carte, fiches techniques, coût matière et marge, photos, menu QR public, ruptures en service
- [ ] Phase 3 — Commandes et caisse
- [ ] Phase 4 — Clients et fidelite
- [ ] Phase 5 — Reservations
- [ ] Phase 6 — Personnel et paie (API et calcul de fiche de paie faits ; interface en attente)
- [ ] Phase 7 — Finance, factures, TVA
- [ ] Phase 8 — Previsions et tableaux de bord

Le detail de chaque phase est dans le document `roadmap` du projet Claude.

## Conventions

- Les montants sont stockes en **millimes** (entiers). 1 DT = 1000 millimes.
  Le formatage se fait a l'affichage via `client/src/lib/format.js`.
- Le stock courant n'est jamais une colonne modifiee : il est agrege depuis
  `stock_batches`, chaque operation laissant une trace dans `stock_movements`.
- Les couleurs, rayons et typographies vivent dans `client/src/styles/theme.css`
  (cuivre `#a8683a`, sable `#e9cf9e`, or `#c79a3e`, olive `#6e7a4f`, titres en
  Cinzel). Changer la charte graphique = modifier ce seul fichier.
- Le mot-symbole est dans `client/public/` : `logo-hasdrubal.png` pour les fonds
  clairs, `logo-hasdrubal-light.png` pour le theme sombre. Remplacer ces deux
  fichiers suffit a changer le logo partout.
- Theme clair/sombre : clair par defaut (choix du patron), memorise par
  navigateur une fois change via le bouton bascule (`ThemeToggle`, present
  sur les deux interfaces et le menu public). `client/public/theme-init.js`
  applique le theme avant le premier rendu pour eviter un flash ; ne jamais
  le remplacer par un `<script>` inline, cela romprait la politique de
  securite (CSP) du serveur en production.
- La fiche du restaurant (adresse, telephone, horaires, palette) est en base
  dans la table `settings` et exposee par `GET /api/settings`.
