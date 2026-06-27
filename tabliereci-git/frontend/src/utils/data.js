// Données mock centralisées — à remplacer par appels API

export const RESTAURATEURS = [
  { id: 1, name: "Le Maquis du Plateau", owner: "Kouadio Jean",  ville: "Plateau, Abidjan",  email: "maquis@ci.com",   plan: "Premium",  status: "actif",      reserv: 312, rating: 4.8, qrActive: true,  joined: "Jan 2025" },
  { id: 2, name: "La Terrasse d'Abidjan",owner: "Aya Koné",      ville: "Cocody, Abidjan",   email: "terrasse@ci.com", plan: "Standard", status: "actif",      reserv: 187, rating: 4.5, qrActive: false, joined: "Mar 2025" },
  { id: 3, name: "Saveurs de Cocody",    owner: "Diallo Ibou",   ville: "Cocody, Abidjan",   email: "saveurs@ci.com",  plan: "Premium",  status: "actif",      reserv: 98,  rating: 4.9, qrActive: true,  joined: "Avr 2025" },
  { id: 4, name: "Maquis Yopougon",      owner: "Bamba Seydou",  ville: "Yopougon",          email: "yopo@ci.com",     plan: "Gratuit",  status: "suspendu",   reserv: 42,  rating: 3.9, qrActive: false, joined: "Juin 2025" },
  { id: 5, name: "Le Bord de Mer",       owner: "Yao Amenan",    ville: "Marcory",           email: "bmer@ci.com",     plan: "Standard", status: "en attente", reserv: 0,   rating: 0,   qrActive: false, joined: "Juin 2026" },
];

export const UTILISATEURS = [
  { id: 1, name: "Fatou Amara",      email: "fatou@mail.com", ville: "Abidjan", reserv: 14, lastRes: "17 juin 2026", status: "actif",  joined: "Fév 2025" },
  { id: 2, name: "Ibrahima Diallo",  email: "ib@mail.com",    ville: "Abidjan", reserv: 9,  lastRes: "16 juin 2026", status: "actif",  joined: "Mar 2025" },
  { id: 3, name: "Marie-Claire K.",  email: "mc@mail.com",    ville: "Bouaké",  reserv: 5,  lastRes: "15 juin 2026", status: "actif",  joined: "Avr 2025" },
  { id: 4, name: "Yannick Brou",     email: "yb@mail.com",    ville: "Abidjan", reserv: 2,  lastRes: "10 juin 2026", status: "bloqué", joined: "Mai 2025" },
];

export const RESERVATIONS = [
  { id: "RES-0041", client: "Ibrahima D.",    resto: "Le Maquis du Plateau",  date: "17 juin · 20h00", pers: 4, table: "TE2", payment: "MTN MoMo",    montant: 12000, status: "confirmé"   },
  { id: "RES-0040", client: "Marie-Claire K.",resto: "La Terrasse d'Abidjan", date: "17 juin · 20h00", pers: 2, table: "T6",  payment: "Wave",         montant: 8500,  status: "confirmé"   },
  { id: "RES-0039", client: "Fatou Amara",    resto: "Saveurs de Cocody",     date: "17 juin · 21h00", pers: 6, table: "T5",  payment: "Orange Money", montant: 24000, status: "en attente" },
  { id: "RES-0038", client: "Yannick Brou",   resto: "Le Maquis du Plateau",  date: "17 juin · 21h00", pers: 2, table: "TE3", payment: "—",            montant: 0,     status: "annulé"     },
];

export const MENU_CATEGORIES = [
  {
    id: 1, name: "Plats principaux",
    items: [
      { id: 1, name: "Attiéké Poisson Braisé",  desc: "Semoule de manioc, tilapia braisé, sauce tomate pimentée", price: 3500, active: true  },
      { id: 2, name: "Kedjenou de Poulet",       desc: "Poulet mijoté, aubergines, épices, riz blanc",             price: 4200, active: true  },
      { id: 3, name: "Alloco Poulet",            desc: "Banane plantain frite, poulet frit, sauce piment maison",  price: 2800, active: false },
      { id: 4, name: "Sauce Graine au Crabe",   desc: "Huile de palme, crabe de rivière, igname ou riz",          price: 5000, active: true  },
    ],
  },
  {
    id: 2, name: "Entrées",
    items: [
      { id: 5, name: "Salade Ivoirienne", desc: "Légumes frais, vinaigrette maison", price: 1500, active: true },
      { id: 6, name: "Beignets de Crevettes", desc: "Crevettes panées, sauce cocktail", price: 2000, active: true },
    ],
  },
  {
    id: 3, name: "Boissons",
    items: [
      { id: 7, name: "Jus de Gingembre",  desc: "Maison, frais du jour",   price: 800,  active: true },
      { id: 8, name: "Bissap",            desc: "Hibiscus, menthe, sucre", price: 700,  active: true },
      { id: 9, name: "Eau minérale",      desc: "50cl",                   price: 500,  active: true },
    ],
  },
  {
    id: 4, name: "Desserts",
    items: [
      { id: 10, name: "Gâteau au Manioc", desc: "Spécialité maison",           price: 1200, active: true  },
      { id: 11, name: "Ananas grillé",    desc: "Caramélisé, glace vanille",   price: 1500, active: false },
    ],
  },
];

export const TABLES = [
  { id: "T1",  cap: 4, status: "libre"    },
  { id: "T2",  cap: 2, status: "occupé"   },
  { id: "T3",  cap: 2, status: "libre"    },
  { id: "T4",  cap: 4, status: "réservé", client: "Kouassi A.", heure: "20h30" },
  { id: "T5",  cap: 6, status: "libre"    },
  { id: "T6",  cap: 4, status: "réservé", client: "Marie-Claire K.", heure: "20h00" },
  { id: "T7",  cap: 2, status: "libre"    },
  { id: "T8",  cap: 8, status: "occupé"   },
  { id: "TE1", cap: 2, status: "libre"    },
  { id: "TE2", cap: 4, status: "réservé", client: "Ibrahima D.", heure: "20h00" },
  { id: "TE3", cap: 4, status: "libre"    },
  { id: "TE4", cap: 6, status: "occupé"   },
];

export const fmt = (n) =>
  n ? n.toLocaleString("fr-FR") + " F" : "—";
