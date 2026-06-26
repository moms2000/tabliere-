import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Utensils, Users, CalendarCheck, CreditCard,
  Settings, Bell, Search, ChevronDown, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, XCircle, Clock, MoreVertical,
  BarChart3, Globe, Shield, Database, Zap, Menu, X,
  Eye, Edit, Trash2, Plus, Download, Filter, RefreshCw,
  MapPin, Phone, Mail, Star, ChevronRight, Activity
} from "lucide-react";

// ─── Animation variants ───────────────────────────────────────────────────────
const sidebar_v = {
  open:   { width: 240, transition: { type: "spring", stiffness: 300, damping: 30 } },
  closed: { width: 64,  transition: { type: "spring", stiffness: 300, damping: 30 } },
};
const fade_up = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.35, ease: "easeOut" } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};
const card_hover = { scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 20 } };

// ─── Couleurs marque ──────────────────────────────────────────────────────────
const G = "#1D9E75";   // vert principal
const GL = "#E1F5EE";  // vert clair

// ─── Données mock ─────────────────────────────────────────────────────────────
const metrics = [
  { label: "Restaurateurs actifs",  value: "142",    delta: "+8",   up: true,  icon: Utensils,     color: "#1D9E75" },
  { label: "Utilisateurs inscrits", value: "8 430",  delta: "+214", up: true,  icon: Users,        color: "#185FA5" },
  { label: "Réservations (mois)",   value: "3 217",  delta: "+12%", up: true,  icon: CalendarCheck,color: "#854F0B" },
  { label: "Revenus (FCFA)",        value: "4.2M",   delta: "-3%",  up: false, icon: CreditCard,   color: "#993C1D" },
];

const nav_items = [
  { id: "overview",      label: "Vue d'ensemble",    icon: LayoutDashboard },
  { id: "restaurateurs", label: "Restaurateurs",     icon: Utensils        },
  { id: "utilisateurs",  label: "Utilisateurs",      icon: Users           },
  { id: "reservations",  label: "Réservations",      icon: CalendarCheck   },
  { id: "finances",      label: "Finances",          icon: CreditCard      },
  { id: "systeme",       label: "Système",           icon: Activity        },
  { id: "parametres",    label: "Paramètres",        icon: Settings        },
];

const restaurateurs = [
  { id: 1, name: "Le Maquis du Plateau", owner: "Kouadio Jean", ville: "Plateau, Abidjan", tel: "+225 07 00 00 01", email: "maquis@ci.com",   plan: "Premium",  status: "actif",    reserv: 312, rating: 4.8, joined: "Jan 2025" },
  { id: 2, name: "La Terrasse d'Abidjan",owner: "Aya Koné",     ville: "Cocody, Abidjan",  tel: "+225 07 00 00 02", email: "terrasse@ci.com", plan: "Standard", status: "actif",    reserv: 187, rating: 4.5, joined: "Mar 2025" },
  { id: 3, name: "Saveurs de Cocody",    owner: "Diallo Ibou",  ville: "Cocody, Abidjan",  tel: "+225 07 00 00 03", email: "saveurs@ci.com",  plan: "Premium",  status: "actif",    reserv: 98,  rating: 4.9, joined: "Avr 2025" },
  { id: 4, name: "Maquis Yopougon",      owner: "Bamba Seydou", ville: "Yopougon",         tel: "+225 07 00 00 04", email: "yopo@ci.com",     plan: "Gratuit",  status: "suspendu", reserv: 42,  rating: 3.9, joined: "Juin 2025" },
  { id: 5, name: "Le Bord de Mer",       owner: "Yao Amenan",   ville: "Marcory",          tel: "+225 07 00 00 05", email: "bmer@ci.com",     plan: "Standard", status: "en attente",reserv: 0, rating: 0,   joined: "Juin 2026" },
];

const utilisateurs = [
  { id: 1, name: "Fatou Amara",      email: "fatou@mail.com",  ville: "Abidjan", reserv: 14, lastRes: "17 juin 2026", status: "actif",   joined: "Fév 2025" },
  { id: 2, name: "Ibrahima Diallo",  email: "ib@mail.com",     ville: "Abidjan", reserv: 9,  lastRes: "16 juin 2026", status: "actif",   joined: "Mar 2025" },
  { id: 3, name: "Marie-Claire K.",  email: "mc@mail.com",     ville: "Bouaké",  reserv: 5,  lastRes: "15 juin 2026", status: "actif",   joined: "Avr 2025" },
  { id: 4, name: "Yannick Brou",     email: "yb@mail.com",     ville: "Abidjan", reserv: 2,  lastRes: "10 juin 2026", status: "bloqué",  joined: "Mai 2025" },
];

const reservations_data = [
  { id: "RES-0041", client: "Ibrahima D.", resto: "Le Maquis du Plateau", date: "17 juin · 20h00", pers: 4, table: "TE2", payment: "MTN MoMo", montant: "12 000 F", status: "confirmé"   },
  { id: "RES-0040", client: "Marie-Claire K.", resto: "La Terrasse d'Abidjan", date: "17 juin · 20h00", pers: 2, table: "T6", payment: "Wave", montant: "8 500 F", status: "confirmé"   },
  { id: "RES-0039", client: "Fatou Amara",  resto: "Saveurs de Cocody", date: "17 juin · 21h00", pers: 6, table: "T5", payment: "Orange Money", montant: "24 000 F", status: "en attente" },
  { id: "RES-0038", client: "Yannick Brou", resto: "Le Maquis du Plateau", date: "17 juin · 21h00", pers: 2, table: "TE3", payment: "—", montant: "—", status: "annulé"    },
];

const notifs = [
  { type: "success", msg: "Saveurs de Cocody a validé son abonnement Premium",    time: "Il y a 3 min"  },
  { type: "warning", msg: "Maquis Yopougon — 2 no-shows signalés cette semaine",  time: "Il y a 20 min" },
  { type: "error",   msg: "Erreur paiement Wave — RES-0037 à retraiter",          time: "Il y a 45 min" },
  { type: "info",    msg: "5 nouvelles inscriptions restaurateurs aujourd'hui",   time: "Il y a 1h"     },
];

const plans = [
  { name: "Gratuit",  price: "0 F",        features: ["5 tables", "50 résa/mois", "Support email"],                    count: 38, color: "#888780" },
  { name: "Standard", price: "25 000 F/mois", features: ["Tables illimitées", "500 résa/mois", "WhatsApp", "Analytics"], count: 71, color: "#185FA5" },
  { name: "Premium",  price: "60 000 F/mois", features: ["Tout Standard", "API", "Manager dédié", "White label"],        count: 33, color: "#1D9E75" },
];

// ─── Helpers UI ───────────────────────────────────────────────────────────────
const StatusBadge = ({ s }) => {
  const map = {
    "actif":       { bg: "#E1F5EE", color: "#0F6E56" },
    "suspendu":    { bg: "#FAECE7", color: "#993C1D" },
    "en attente":  { bg: "#FAEEDA", color: "#854F0B" },
    "confirmé":    { bg: "#E1F5EE", color: "#0F6E56" },
    "annulé":      { bg: "#FAECE7", color: "#993C1D" },
    "bloqué":      { bg: "#FAECE7", color: "#993C1D" },
  };
  const style = map[s] || { bg: "#F1EFE8", color: "#5F5E5A" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, background: style.bg, color: style.color,
      padding: "2px 9px", borderRadius: 10 }}>{s}</span>
  );
};

const NotifIcon = ({ type }) => {
  const map = { success: { Icon: CheckCircle, bg: "#E1F5EE", color: "#1D9E75" },
                warning:  { Icon: AlertCircle, bg: "#FAEEDA", color: "#854F0B" },
                error:    { Icon: XCircle,     bg: "#FAECE7", color: "#993C1D" },
                info:     { Icon: Clock,       bg: "#E6F1FB", color: "#185FA5" } };
  const { Icon, bg, color } = map[type];
  return <div style={{ width: 30, height: 30, borderRadius: "50%", background: bg, display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Icon size={15} color={color} />
  </div>;
};

// ─── Composants de section ────────────────────────────────────────────────────
const SectionTitle = ({ title, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{title}</h2>
    {action && <button onClick={action.fn} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13,
      border: "0.5px solid #ccc", borderRadius: 8, padding: "6px 12px", background: "white", cursor: "pointer", color: "#333" }}>
      {action.icon && <action.icon size={14} />}{action.label}
    </button>}
  </div>
);

// ─── VUE : Overview ──────────────────────────────────────────────────────────
const OverviewView = () => (
  <motion.div variants={stagger} initial="hidden" animate="show">
    {/* Metrics */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {metrics.map((m, i) => (
        <motion.div key={i} variants={fade_up} whileHover={card_hover}
          style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.color + "18",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <m.icon size={18} color={m.color} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: m.up ? "#1D9E75" : "#D85A30",
              display: "flex", alignItems: "center", gap: 3 }}>
              {m.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{m.delta}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#1a1a1a", marginBottom: 3 }}>{m.value}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{m.label}</div>
        </motion.div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 14 }}>
      {/* Réservations récentes */}
      <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <SectionTitle title="Réservations récentes" action={{ label: "Tout voir", icon: ChevronRight, fn: () => {} }} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
            {["ID","Client","Restaurant","Date","Statut","Montant"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#888", fontWeight: 500, fontSize: 11 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {reservations_data.map((r, i) => (
              <motion.tr key={i} whileHover={{ background: "#f9f9f9" }} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 11, color: "#888" }}>{r.id}</td>
                <td style={{ padding: "8px", fontWeight: 500 }}>{r.client}</td>
                <td style={{ padding: "8px", color: "#555" }}>{r.resto}</td>
                <td style={{ padding: "8px", color: "#555", fontSize: 12 }}>{r.date}</td>
                <td style={{ padding: "8px" }}><StatusBadge s={r.status} /></td>
                <td style={{ padding: "8px", fontWeight: 500 }}>{r.montant}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <SectionTitle title="Alertes système" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notifs.map((n, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < notifs.length - 1 ? "0.5px solid #f5f5f5" : "none" }}>
              <NotifIcon type={n.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#333", lineHeight: 1.4, marginBottom: 2 }}>{n.msg}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{n.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>

    {/* Plans */}
    <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <SectionTitle title="Répartition des abonnements" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {plans.map((p, i) => (
          <motion.div key={i} whileHover={card_hover}
            style={{ border: `0.5px solid ${p.color}44`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 14, color: p.color }}>{p.name}</span>
              <span style={{ fontSize: 20, fontWeight: 500 }}>{p.count}</span>
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>{p.price}</div>
            <div style={{ background: "#f5f5f5", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(p.count / 142) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                style={{ height: "100%", background: p.color, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
              {((p.count / 142) * 100).toFixed(0)}% des restaurateurs
            </div>
            <div style={{ marginTop: 8 }}>
              {p.features.map((f, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666", marginBottom: 2 }}>
                  <CheckCircle size={10} color={p.color} />{f}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

// ─── VUE : Restaurateurs ─────────────────────────────────────────────────────
const RestaurateursView = () => {
  const [search, setSearch] = useState("");
  const filtered = restaurateurs.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.owner.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Restaurateurs ({restaurateurs.length})</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, border: "0.5px solid #ddd",
              borderRadius: 8, padding: "6px 12px", background: "#fafafa" }}>
              <Search size={14} color="#888" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..." style={{ border: "none", background: "transparent",
                fontSize: 13, outline: "none", width: 160 }} />
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, border: "0.5px solid #ddd",
              borderRadius: 8, padding: "6px 12px", background: "white", cursor: "pointer" }}>
              <Filter size={14} />Filtrer
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, border: "none",
              borderRadius: 8, padding: "6px 14px", background: G, color: "white", cursor: "pointer", fontWeight: 500 }}>
              <Plus size={14} />Ajouter
            </button>
          </div>
        </div>

        <AnimatePresence>
          {filtered.map((r, i) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ delay: i * 0.05 }}
              whileHover={{ background: "#fafff9" }}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.7fr 0.7fr 0.8fr auto",
                alignItems: "center", gap: 12, padding: "12px 8px",
                borderBottom: "0.5px solid #f5f5f5", borderRadius: 6 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={10} />{r.ville}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{r.owner}</div>
                <div style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={10} />{r.email}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 9px", borderRadius: 10,
                  background: r.plan === "Premium" ? "#E1F5EE" : r.plan === "Standard" ? "#E6F1FB" : "#F1EFE8",
                  color: r.plan === "Premium" ? "#0F6E56" : r.plan === "Standard" ? "#185FA5" : "#5F5E5A" }}>
                  {r.plan}
                </span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.reserv}</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>résa</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#EF9F27", fontWeight: 500 }}>
                  {r.rating > 0 ? `★ ${r.rating}` : "—"}
                </div>
              </div>
              <div><StatusBadge s={r.status} /></div>
              <div style={{ display: "flex", gap: 4 }}>
                <button title="Voir" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 6, color: "#888" }}>
                  <Eye size={15} />
                </button>
                <button title="Modifier" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 6, color: "#888" }}>
                  <Edit size={15} />
                </button>
                <button title="Plus" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 6, color: "#888" }}>
                  <MoreVertical size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// ─── VUE : Utilisateurs ───────────────────────────────────────────────────────
const UtilisateursView = () => (
  <motion.div variants={stagger} initial="hidden" animate="show">
    <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <SectionTitle title={`Utilisateurs (${utilisateurs.length})`} action={{ label: "Exporter CSV", icon: Download, fn: () => {} }} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ borderBottom: "0.5px solid #eee" }}>
          {["Nom","Email","Ville","Réservations","Dernière résa","Statut","Inscrit","Actions"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#888", fontWeight: 500, fontSize: 11 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {utilisateurs.map((u, i) => (
            <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
              whileHover={{ background: "#fafff9" }} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
              <td style={{ padding: "10px 8px", fontWeight: 500 }}>{u.name}</td>
              <td style={{ padding: "10px 8px", color: "#555" }}>{u.email}</td>
              <td style={{ padding: "10px 8px", color: "#888", fontSize: 12 }}>{u.ville}</td>
              <td style={{ padding: "10px 8px", fontWeight: 500, textAlign: "center" }}>{u.reserv}</td>
              <td style={{ padding: "10px 8px", fontSize: 12, color: "#666" }}>{u.lastRes}</td>
              <td style={{ padding: "10px 8px" }}><StatusBadge s={u.status} /></td>
              <td style={{ padding: "10px 8px", fontSize: 11, color: "#aaa" }}>{u.joined}</td>
              <td style={{ padding: "10px 8px" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "#888" }}><Eye size={14} /></button>
                  <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "#888" }}><Edit size={14} /></button>
                  <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cc3333" }}><Trash2 size={14} /></button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  </motion.div>
);

// ─── VUE : Finances ───────────────────────────────────────────────────────────
const FinancesView = () => {
  const months = ["Jan","Fév","Mar","Avr","Mai","Jun"];
  const vals   = [820, 1050, 980, 1340, 1680, 2100];
  const maxV = Math.max(...vals);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Revenus totaux (2026)",   value: "7 970 000 F", icon: TrendingUp, color: G },
          { label: "Commissions collectées",  value: "1 594 000 F", icon: CreditCard, color: "#185FA5" },
          { label: "Abonnements actifs",      value: "104",         icon: Zap, color: "#854F0B" },
        ].map((m, i) => (
          <motion.div key={i} variants={fade_up} whileHover={card_hover}
            style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: m.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <m.icon size={16} color={m.color} />
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>{m.label}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{m.value}</div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <SectionTitle title="Revenus mensuels (FCFA × 1000)" />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140, paddingTop: 10 }}>
          {vals.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{v}k</div>
              <motion.div initial={{ height: 0 }} animate={{ height: `${(v / maxV) * 110}px` }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                style={{ width: "100%", background: i === vals.length - 1 ? G : GL,
                  borderRadius: "4px 4px 0 0", border: `0.5px solid ${i === vals.length - 1 ? "#0F6E56" : "#5DCAA5"}` }} />
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{months[i]}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <SectionTitle title="Modes de paiement" />
        {[
          { name: "Orange Money", pct: 42, color: "#FF8C00" },
          { name: "Wave",         pct: 31, color: "#1D9E75" },
          { name: "MTN MoMo",     pct: 18, color: "#FFC107" },
          { name: "Carte bancaire",pct: 9,  color: "#185FA5" },
        ].map((p, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>{p.name}</span><span style={{ fontWeight: 500 }}>{p.pct}%</span>
            </div>
            <div style={{ background: "#f0f0f0", borderRadius: 4, height: 7, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${p.pct}%` }}
                transition={{ delay: i * 0.1 + 0.3, duration: 0.6, ease: "easeOut" }}
                style={{ height: "100%", background: p.color, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};

// ─── VUE : Système ────────────────────────────────────────────────────────────
const SystemeView = () => (
  <motion.div variants={stagger} initial="hidden" animate="show">
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {[
        { title: "Santé de l'API", icon: Globe, items: [
          { label: "Uptime", val: "99.98%", ok: true },
          { label: "Latence moyenne", val: "142ms", ok: true },
          { label: "Erreurs (24h)", val: "3", ok: true },
          { label: "Appels API (24h)", val: "18 420", ok: true },
        ]},
        { title: "Base de données", icon: Database, items: [
          { label: "PostgreSQL", val: "Connecté", ok: true },
          { label: "Redis cache", val: "Connecté", ok: true },
          { label: "Stockage utilisé", val: "12.4 GB / 100 GB", ok: true },
          { label: "Sauvegardes", val: "Dernière: 06h00", ok: true },
        ]},
        { title: "Sécurité", icon: Shield, items: [
          { label: "Tentatives suspectes (24h)", val: "2", ok: true },
          { label: "2FA activé", val: "68% des admins", ok: false },
          { label: "Certificat SSL", val: "Valide — expire dans 89j", ok: true },
          { label: "Firewall", val: "Actif", ok: true },
        ]},
        { title: "Performances", icon: Zap, items: [
          { label: "CPU moyen", val: "34%", ok: true },
          { label: "RAM utilisée", val: "2.1 GB / 8 GB", ok: true },
          { label: "Requêtes/sec", val: "47", ok: true },
          { label: "CDN Abidjan", val: "Opérationnel", ok: true },
        ]},
      ].map((card, i) => (
        <motion.div key={i} variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <card.icon size={17} color={G} />
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{card.title}</h3>
          </div>
          {card.items.map((item, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 0", borderBottom: j < card.items.length - 1 ? "0.5px solid #f5f5f5" : "none", fontSize: 13 }}>
              <span style={{ color: "#666" }}>{item.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 500 }}>{item.val}</span>
                {item.ok
                  ? <CheckCircle size={13} color="#1D9E75" />
                  : <AlertCircle size={13} color="#D85A30" />}
              </div>
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  </motion.div>
);

// ─── VUE : Paramètres ─────────────────────────────────────────────────────────
const ParametresView = () => {
  const [toggled, setToggled] = useState({ whatsapp: true, wave: true, orange: true, mtn: true,
    maintenance: false, emailNotif: true, sms: false, twofa: true });
  const toggle = k => setToggled(p => ({ ...p, [k]: !p[k] }));
  const Toggle = ({ k }) => (
    <motion.div onClick={() => toggle(k)} style={{ width: 40, height: 22, borderRadius: 11,
      background: toggled[k] ? G : "#ddd", cursor: "pointer", position: "relative", flexShrink: 0 }}>
      <motion.div animate={{ x: toggled[k] ? 20 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 18, height: 18, borderRadius: "50%", background: "white",
          position: "absolute", top: 2 }} />
    </motion.div>
  );

  const Section = ({ title, rows }) => (
    <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 14, color: "#333" }}>{title}</h3>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 0", borderBottom: i < rows.length - 1 ? "0.5px solid #f5f5f5" : "none" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
            {r.sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{r.sub}</div>}
          </div>
          {r.toggle !== undefined ? <Toggle k={r.toggle} />
            : r.value ? <span style={{ fontSize: 13, color: "#888" }}>{r.value}</span>
            : <button style={{ fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6,
                padding: "4px 10px", background: "white", cursor: "pointer", color: "#555" }}>
                {r.action}
              </button>}
        </div>
      ))}
    </motion.div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <Section title="Général" rows={[
        { label: "Nom de la plateforme", value: "TablièreCI" },
        { label: "Langue par défaut", value: "Français (Côte d'Ivoire)" },
        { label: "Fuseau horaire", value: "Africa/Abidjan (UTC+0)" },
        { label: "Devise", value: "FCFA (XOF)" },
        { label: "Mode maintenance", sub: "Affiche une page d'interruption aux visiteurs", toggle: "maintenance" },
      ]} />
      <Section title="Paiements acceptés" rows={[
        { label: "Orange Money", sub: "Paiement mobile Orange CI", toggle: "orange" },
        { label: "Wave",         sub: "Paiement mobile Wave",      toggle: "wave"   },
        { label: "MTN MoMo",    sub: "Paiement mobile MTN CI",    toggle: "mtn"    },
        { label: "Carte bancaire", action: "Configurer Stripe" },
      ]} />
      <Section title="Notifications" rows={[
        { label: "Notifications WhatsApp", sub: "Rappels et confirmations de réservation", toggle: "whatsapp" },
        { label: "Notifications email",    sub: "Via SendGrid",  toggle: "emailNotif" },
        { label: "SMS",                    sub: "Via Twilio CI", toggle: "sms" },
      ]} />
      <Section title="Sécurité" rows={[
        { label: "Double authentification (2FA)", sub: "Obligatoire pour tous les admins", toggle: "twofa" },
        { label: "Logs d'accès", action: "Voir les logs" },
        { label: "Réinitialiser les clés API", action: "Régénérer" },
      ]} />
      <Section title="Commission plateforme" rows={[
        { label: "Commission par réservation", value: "5% du ticket moyen" },
        { label: "Commission abonnement", action: "Modifier" },
        { label: "Politique remboursement", action: "Éditer" },
      ]} />
    </motion.div>
  );
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const [notifOpen, setNotifOpen] = useState(false);

  const views = {
    overview:      <OverviewView />,
    restaurateurs: <RestaurateursView />,
    utilisateurs:  <UtilisateursView />,
    reservations:  <motion.div initial="hidden" animate="show" variants={stagger}>
                     <motion.div variants={fade_up} style={{ background: "white", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
                       <SectionTitle title="Toutes les réservations" action={{ label: "Exporter", icon: Download, fn: () => {} }} />
                       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                         <thead><tr style={{ borderBottom: "0.5px solid #eee" }}>
                           {["ID","Client","Restaurant","Date","Pers.","Table","Paiement","Montant","Statut"].map(h => (
                             <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#888", fontWeight: 500, fontSize: 11 }}>{h}</th>
                           ))}
                         </tr></thead>
                         <tbody>
                           {reservations_data.map((r, i) => (
                             <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                               whileHover={{ background: "#fafff9" }} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                               <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 11, color: "#888" }}>{r.id}</td>
                               <td style={{ padding: "8px", fontWeight: 500 }}>{r.client}</td>
                               <td style={{ padding: "8px", color: "#555" }}>{r.resto}</td>
                               <td style={{ padding: "8px", fontSize: 12 }}>{r.date}</td>
                               <td style={{ padding: "8px", textAlign: "center" }}>{r.pers}</td>
                               <td style={{ padding: "8px" }}>{r.table}</td>
                               <td style={{ padding: "8px", fontSize: 12, color: "#666" }}>{r.payment}</td>
                               <td style={{ padding: "8px", fontWeight: 500 }}>{r.montant}</td>
                               <td style={{ padding: "8px" }}><StatusBadge s={r.status} /></td>
                             </motion.tr>
                           ))}
                         </tbody>
                       </table>
                     </motion.div>
                   </motion.div>,
    finances:  <FinancesView />,
    systeme:   <SystemeView />,
    parametres:<ParametresView />,
  };

  const currentNav = nav_items.find(n => n.id === activeView);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f7f7f5", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <motion.aside variants={sidebar_v} animate={sidebarOpen ? "open" : "closed"}
        style={{ background: "white", borderRight: "0.5px solid #e5e5e5", display: "flex",
          flexDirection: "column", overflow: "hidden", flexShrink: 0, zIndex: 10 }}>

        {/* Logo */}
        <div style={{ padding: "16px 14px", borderBottom: "0.5px solid #f0f0f0",
          display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Utensils size={17} color="white" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 15, fontWeight: 500, color: G, whiteSpace: "nowrap" }}>
                TablièreCI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {nav_items.map(item => {
            const active = activeView === item.id;
            return (
              <motion.button key={item.id} onClick={() => setActiveView(item.id)}
                whileHover={{ background: active ? GL : "#f5f5f5" }}
                whileTap={{ scale: 0.97 }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                  borderRadius: 8, marginBottom: 2, border: "none", cursor: "pointer",
                  background: active ? GL : "transparent",
                  color: active ? G : "#555", fontWeight: active ? 500 : 400, fontSize: 13,
                  textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>
                <item.icon size={17} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 8px", borderTop: "0.5px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: GL,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
              fontWeight: 500, color: G, flexShrink: 0 }}>AD</div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Super Admin</div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>admin@tabliereci.ci</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* ── Contenu principal ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "white", borderBottom: "0.5px solid #e5e5e5", padding: "0 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen(p => !p)}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#555", padding: 4 }}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>
              {currentNav?.label || "Dashboard"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 7, border: "0.5px solid #e5e5e5",
              borderRadius: 8, padding: "6px 12px", background: "#fafafa", cursor: "pointer", fontSize: 13 }}>
              <RefreshCw size={13} color="#888" />Actualiser
            </button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => setNotifOpen(p => !p)}
              style={{ position: "relative", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "6px 10px",
                background: "#fafafa", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Bell size={16} color="#555" />
              <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8,
                borderRadius: "50%", background: "#D85A30", border: "1.5px solid white" }} />
            </motion.button>
          </div>
        </div>

        {/* Notif panel */}
        <AnimatePresence>
          {notifOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ position: "absolute", top: 52, right: 20, width: 320, background: "white",
                border: "0.5px solid #e5e5e5", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", zIndex: 100, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Notifications</div>
              {notifs.map((n, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0",
                  borderBottom: i < notifs.length - 1 ? "0.5px solid #f5f5f5" : "none" }}>
                  <NotifIcon type={n.type} />
                  <div><div style={{ fontSize: 12, color: "#333" }}>{n.msg}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{n.time}</div></div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {views[activeView]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
