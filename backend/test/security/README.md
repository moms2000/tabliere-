# Tests de sécurité des routes

Tests d'intégration qui vérifient la sécurité du câblage des routes contre un
serveur en cours d'exécution : authentification requise, rôles, isolation
entre restaurants (IDOR), `denyStaff`, `requireTab` (onglets staff), correctif
messagerie, anti-SSRF webhook, garde-fou Mode Vitrine, et l'auth des opérations
d'événement (jeton révoqué / post-reset / suspendu).

## Lancer

```bash
npm run test:security
```

Le script `run.sh` démarre un backend jetable (base de TEST locale, sans Redis),
attend `/health`, joue les deux suites, puis arrête le serveur.

## Base de données

Par défaut `postgresql://localhost:5432/tabliere_otp`. Surcharge possible :

```bash
DATABASE_URL=postgresql://localhost:5432/ma_base_test npm run test:security
```

Les scripts REFUSENT de tourner si `DATABASE_URL` ressemble à une base distante
ou de production (render, onrender, amazonaws, neon, supabase). Ils créent des
comptes/restaurants/événements temporaires et les suppriment à la fin.

## Quand les lancer

À chaque modification touchant l'authentification, les rôles, les middlewares
(`auth.js`, `eventAuth.js`), le câblage des routes, ou l'ajout d'une route
sensible. C'est le filet qui garantit qu'un changement ne rouvre pas un accès.
