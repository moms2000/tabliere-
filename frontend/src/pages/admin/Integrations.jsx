import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plug, Search, ChevronLeft, ChevronRight, Settings2, AlertTriangle } from "lucide-react";
import { Card, PageTitle } from "../../components/ui";
import { integrationService } from "../../services/integration.service.js";
import IntegrationCaisse from "../restaurant/IntegrationCaisse.jsx";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Pill({ children, color, bg }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap" }}>{children}</span>;
}

function StatusPill({ row }) {
  if (!row.configured) return <Pill color="#9BA89F" bg="#F1F0EC">Non configurée</Pill>;
  if (!row.is_active)  return <Pill color="#C0392B" bg="#FDECEA">En pause</Pill>;
  const s = row.last_delivery_status;
  if (s && !s.startsWith("ok") && s !== "warmup") return <Pill color="#C0392B" bg="#FDECEA">Dernier envoi en échec</Pill>;
  return <Pill color="#1D9E75" bg="#E8F5EE">Active</Pill>;
}

export default function AdminIntegrations() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [sel, setSel]         = useState(null); // { restaurant_id, name }

  const load = async () => {
    setLoading(true);
    try { setRows(await integrationService.listAll()); }
    catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  const stats = useMemo(() => ({
    total:     rows.length,
    active:    rows.filter((r) => r.configured && r.is_active).length,
    failing:   rows.filter((r) => r.configured && r.is_active && r.last_delivery_status && !r.last_delivery_status.startsWith("ok") && r.last_delivery_status !== "warmup").length,
    unconfig:  rows.filter((r) => !r.configured).length,
  }), [rows]);

  // ── Vue détail : gestion complète d'un restaurant ──────────────────────────
  if (sel) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp}>
          <button type="button" onClick={() => { setSel(null); load(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none",
              color: "#3D6B55", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 10 }}>
            <ChevronLeft size={16} /> Toutes les intégrations
          </button>
          <PageTitle title={sel.name || "Restaurant"} subtitle="Gestion de l'intégration caisse (au nom du restaurant)" />
        </motion.div>
        <IntegrationCaisse restaurantId={sel.restaurant_id} admin />
      </motion.div>
    );
  }

  // ── Vue liste ──────────────────────────────────────────────────────────────
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Intégrations caisse" subtitle="Superviser et gérer l'intégration de chaque restaurant" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Restaurants",       val: stats.total,    color: "#1a1a1a" },
          { label: "Intégrations actives", val: stats.active, color: "#1D9E75" },
          { label: "Envois en échec",   val: stats.failing,  color: stats.failing ? "#C0392B" : "#1a1a1a" },
          { label: "Non configurées",   val: stats.unconfig, color: "#E8A045" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 130, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8F5EF",
            border: "0.5px solid #E4DFD8", borderRadius: 9, padding: "8px 12px", marginBottom: 12 }}>
            <Search size={15} color="#9BA89F" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un restaurant"
              style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: 14 }} />
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9BA89F", fontSize: 13 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9BA89F", fontSize: 13 }}>Aucun restaurant.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((r) => (
                <button key={r.restaurant_id} type="button" onClick={() => setSel(r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                    background: "white", border: "0.5px solid #E4DFD8", borderRadius: 11, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1E2E28", marginBottom: 3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "Sans nom"}</div>
                    <div style={{ fontSize: 11.5, color: "#9BA89F", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{r.has_key ? `Clé ${r.api_key_prefix}…` : "Aucune clé"}</span>
                      {r.webhook_url && <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {r.webhook_url}</span>}
                      {r.configured && <span>· envoi {fmt(r.last_delivery_at)}</span>}
                    </div>
                  </div>
                  <StatusPill row={r} />
                  <ChevronRight size={17} color="#C7CFC9" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
