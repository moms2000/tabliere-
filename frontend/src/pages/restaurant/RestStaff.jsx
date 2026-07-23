import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, Pencil, X, KeyRound } from "lucide-react";
import { restaurantStaffService } from "../../services/restaurantStaff.service.js";

const P = "#E8A045"; const PL = "#FEF6EC"; const DARK = "#1E2E28"; const BG = "#F8F5EF";
const BORDER = "#E4DFD8"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

const TAB_LABELS = {
  dashboard: "Tableau de bord", reservations: "Réservations", clients: "Mes clients",
  plan: "Plan de salle", menu: "Menu & QR", instants: "Instants",
  pos: "Service rapide", commandes: "Commandes", recus: "Reçus", profil: "Mon restaurant",
};
const ALL_TABS = Object.keys(TAB_LABELS);
const EMPTY = { name: "", login_id: "", pin: "", permissions: [], is_active: true };

export default function RestStaff() {
  const [staff, setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [edit, setEdit]     = useState(null);   // staff en édition, ou null pour création
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await restaurantStaffService.list(); setStaff(d.staff || []); } catch (_) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEdit(null); setForm(EMPTY); setErr(""); setModal(true); };
  const openEdit = (s) => {
    setEdit(s);
    setForm({ name: s.name, login_id: s.login_id, pin: s.pin, permissions: s.permissions || [], is_active: s.is_active });
    setErr(""); setModal(true);
  };
  const toggleTab = (t) => setForm(p => ({
    ...p, permissions: p.permissions.includes(t) ? p.permissions.filter(x => x !== t) : [...p.permissions, t],
  }));

  const save = async () => {
    setErr("");
    if (!form.name.trim()) { setErr("Donnez un nom au rôle (ex. Serveur, Bar, Caissier)."); return; }
    if (!/^[A-Za-z0-9]{2,24}$/.test(form.login_id.trim())) { setErr("Identifiant : 2 à 24 lettres ou chiffres."); return; }
    if (!/^\d{4}$/.test(form.pin.trim())) { setErr("Le code doit faire 4 chiffres."); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), login_id: form.login_id.trim(), pin: form.pin.trim(), permissions: form.permissions, is_active: form.is_active };
      if (edit) await restaurantStaffService.update(edit.id, payload);
      else      await restaurantStaffService.create(payload);
      setModal(false); await load();
    } catch (e) {
      setErr(e.response?.data?.message || "Enregistrement impossible.");
    }
    setSaving(false);
  };

  const del = async (s) => {
    if (!window.confirm(`Supprimer l'accès de « ${s.name} » (${s.login_id}) ?`)) return;
    try { await restaurantStaffService.remove(s.id); setStaff(prev => prev.filter(x => x.id !== s.id)); } catch (_) {}
  };

  return (
    <div style={{ fontFamily: FONT, padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={22} color={P} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: DARK, margin: 0 }}>Mon équipe</h1>
        </div>
        <button onClick={openNew}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10,
            border: "none", background: P, color: "#1a1000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          <Plus size={15} /> Ajouter un membre
        </button>
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>
        Créez vos serveurs, bar, caisse, accueil… Chacun se connecte avec son identifiant et son code à 4 chiffres,
        et ne voit que les onglets que vous cochez.
      </p>

      {loading ? (
        <div style={{ color: MUTED, textAlign: "center", padding: 40 }}>Chargement…</div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: MUTED, background: BG, borderRadius: 14 }}>
          <Users size={38} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Aucun membre pour l'instant.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Ajoutez votre premier serveur ou caissier.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {staff.map(s => (
            <div key={s.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16,
              opacity: s.is_active ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <KeyRound size={12} /> {s.login_id} · code {s.pin}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(s)} title="Modifier"
                    style={{ border: `0.5px solid ${BORDER}`, background: "white", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                    <Pencil size={13} color={MUTED} />
                  </button>
                  <button onClick={() => del(s)} title="Supprimer"
                    style={{ border: `0.5px solid #FCA5A5`, background: "#FEF2F2", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                    <Trash2 size={13} color="#B91C1C" />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                {(s.permissions || []).length === 0 ? (
                  <span style={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>Aucun onglet autorisé</span>
                ) : (s.permissions || []).map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: PL, color: "#C47D1A" }}>
                    {TAB_LABELS[t] || t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {createPortal(
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModal(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60 }} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: "min(440px, 94vw)", maxHeight: "88vh", overflowY: "auto", background: "white",
                borderRadius: 18, zIndex: 61, padding: 22, fontFamily: FONT, boxShadow: "0 10px 40px rgba(0,0,0,.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: DARK }}>{edit ? "Modifier le membre" : "Nouveau membre"}</span>
                <button onClick={() => setModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} color={MUTED} /></button>
              </div>

              <label style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Nom du rôle</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Serveur, Bar, Caissier, Accueil…"
                style={inputStyle} />

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Identifiant</label>
                  <input value={form.login_id} onChange={e => setForm(p => ({ ...p, login_id: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))}
                    placeholder="MARB" style={inputStyle} />
                </div>
                <div style={{ width: 120 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Code (4 chiffres)</label>
                  <input value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="1209" inputMode="numeric" style={inputStyle} />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginTop: 18, marginBottom: 8 }}>Onglets autorisés</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ALL_TABS.map(t => {
                  const on = form.permissions.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => toggleTab(t)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${on ? P : BORDER}`, background: on ? PL : "white", fontFamily: FONT, textAlign: "left" }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        border: `1.5px solid ${on ? P : BORDER}`, background: on ? P : "white", color: "#1a1000", fontSize: 11, fontWeight: 900 }}>{on ? "✓" : ""}</span>
                      <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? "#C47D1A" : DARK }}>{TAB_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>

              {edit && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: DARK, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Accès actif
                </label>
              )}

              {err && <div style={{ marginTop: 14, padding: "9px 12px", background: "#FAECE7", borderRadius: 9, fontSize: 12.5, color: "#993C1D" }}>{err}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setModal(false)}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 11, border: `0.5px solid ${BORDER}`, background: "white", color: MUTED, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  Annuler
                </button>
                <button onClick={save} disabled={saving}
                  style={{ flex: 2, padding: "12px 0", borderRadius: 11, border: "none", background: P, color: "#1a1000", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Enregistrement…" : edit ? "Enregistrer" : "Créer le membre"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", marginTop: 5, border: "0.5px solid #E4DFD8", borderRadius: 10,
  padding: "11px 13px", fontSize: 14, outline: "none", fontFamily: FONT, background: "#F8F5EF",
};
