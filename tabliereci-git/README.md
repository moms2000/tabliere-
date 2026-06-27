# TablièreCI — Plateforme de réservation restaurant (Côte d'Ivoire)

## Stack technique
- **Frontend** : React 18 + Vite + Framer Motion + Lucide Icons
- **Backend** : Node.js + Express (à scaffolder prochainement)
- **Base de données** : PostgreSQL + Redis (cache)
- **Auth** : JWT + refresh tokens
- **Paiements** : Orange Money · MTN MoMo · Wave · Stripe (carte)
- **Notifications** : WhatsApp Business API · Email (SendGrid)

## Structure du projet

```
tabliereci/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/          ← Dashboard super-admin ✅
│   │   │   ├── restaurant/     ← App restaurateur (à venir)
│   │   │   └── client/         ← App client (à venir)
│   │   ├── components/ui/      ← Design system partagé
│   │   ├── hooks/              ← Custom hooks React
│   │   ├── context/            ← Auth, Panier, Notifications
│   │   └── utils/              ← Helpers, formatters
│   └── package.json
└── backend/
    ├── routes/                 ← API REST
    ├── controllers/
    ├── models/                 ← Schémas DB
    └── middleware/             ← Auth, validation, rate-limit
```

## Lancer le projet

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000/admin
```

## Roadmap
- [x] Dashboard admin — Vue d'ensemble, restaurateurs, utilisateurs, finances, système, paramètres
- [ ] Landing page publique animée
- [ ] Interface restaurateur (plan de salle, réservations, analytics)
- [ ] App client (recherche, réservation, profil, historique)
- [ ] Backend Node.js + API REST
- [ ] Intégrations paiement Mobile Money
- [ ] Notifications WhatsApp
- [ ] App mobile React Native
