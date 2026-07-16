import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import {
  Wine, Plus, Pencil, Trash2, Crown, Armchair, Megaphone, Users, LayoutDashboard,
  QrCode, Check, X, Search, Copy, CheckCheck, FileText, Sheet, Ticket,
  Phone, ChevronDown, ChevronUp, AlertTriangle, MapPin, Wallet, TrendingUp, RefreshCw, DoorOpen,
  KeyRound, MessageCircle, UserPlus, Bell, BellOff,
} from "lucide-react";
import { Card, Btn, Modal, FormField, Input, Toggle, Badge } from "../../components/ui";
import { eventsService, eventOpsService } from "../../services/events.service.js";
import QrScanner from "../../components/QrScanner.jsx";
import { playOrderAlarm, unlockAudio } from "../../utils/sound.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";
const fmtInt = (n) => Number(n || 0).toLocaleString("fr-FR");

// Numéro au format international pour wa.me. En Côte d'Ivoire les numéros locaux
// (10 chiffres, ex. 0700000000) doivent être préfixés par l'indicatif 225.
// wa.me n'accepte QUE le format international sans « + » (ex. 2250700000000).
function waPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);       // 00225… → 225…
  if (d.startsWith("225")) return d;             // déjà international (CI)
  if (d.length <= 10) return "225" + d;          // numéro local ivoirien → préfixe 225
  return d;                                       // autre indicatif pays déjà présent
}

// ═══ DASHBOARD ═══════════════════════════════════════════════════════════════
export function DashboardTab({ event }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const load = () => eventsService.dashboard(event.id).then(dd => { setD(dd); setUpdatedAt(new Date()); }).catch(console.error);
  useEffect(() => { load(); }, [event.id]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 15000); // rafraîchissement live toutes les 15 s
    return () => clearInterval(t);
  }, [live, event.id]);
  if (!d) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;

  const r = d.reservations || {}, o = d.orders || {}, v = d.vip || {}, c = d.cash || {}, servers = d.servers || [];
  const stat = (label, val, color = DARK, sub) => (
    <div style={{ flex: 1, minWidth: 130, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color }}>{val}</div>
      {sub ? <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
  const doExport = async (kind) => {
    setBusy(kind);
    try {
      const mod = await import("../../services/exports.js");
      const cols = ["Indicateur", "Valeur"];
      const rows = [
        ["Réservations", fmtInt(r.total)], ["Confirmées", fmtInt(r.confirmed)],
        ["Arrivées (check-in)", fmtInt(r.checked_in)], ["Couverts réservés", fmtInt(r.covers)],
        ["Personnes arrivées", fmtInt(c.arrived_covers)],
        ["— RÉCONCILIATION CAISSE —", ""],
        ["Jauge d'entrées gratuites", c.capacity != null ? fmtInt(c.capacity) : "non définie"],
        ["Entrées gratuites utilisées", fmtInt(c.free_used)],
        ["Entrées payantes (surplus)", fmtInt(c.paid_entries)],
        ["Prix d'entrée", fmt(c.entry_price)],
        ["Espèces entrées attendues", fmt(c.entry_cash_due)],
        ["Bar encaissé", fmt(c.bar_cashed)], ["Bar en attente", fmt(c.bar_pending)],
        ["Revenu VIP", fmt(c.vip_revenue)],
        ["TOTAL ESPÈCES ATTENDU", fmt(c.total_expected)],
        ["— DÉTAIL —", ""],
        ["Packs VIP vendus", fmtInt(v.vip_sold)],
        ["Commandes bouteilles", fmtInt(o.count)], ["Total commandes", fmt(o.total)],
        ...servers.map(s => [`Serveur · ${s.name}`, `${fmtInt(s.orders_count)} cmd · ${fmt(s.revenue)}`]),
        ...(d.top_bottles || []).map(b => [`Bouteille · ${b.name}`, `${b.qty}`]),
        ...(d.promoters || []).map(p => [`Promoteur · ${p.name} (${p.code})`, `${p.reservations} résa`]),
      ];
      const opt = { title: `Dashboard — ${event.name}`, subtitle: "Événement", columns: cols, rows, filename: `dashboard-${event.slug}` };
      kind === "pdf" ? await mod.exportPDF(opt) : await mod.exportXLSX({ ...opt, sheetName: "Dashboard" });
    } catch (e) { alert("Export impossible"); } finally { setBusy(null); }
  };

  // Barre de progression des arrivées vs jauge
  const cap = c.capacity, arrived = c.arrived_covers || 0;
  const pct = cap ? Math.min(100, Math.round((arrived / cap) * 100)) : 0;
  const over = cap != null && arrived > cap;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Barre live + exports */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setLive(l => !l)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `0.5px solid ${BORDER}`, background: "white",
            borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontFamily: FONT, fontSize: 12.5, color: DARK }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: live ? GREEN : MUTED,
            boxShadow: live ? `0 0 0 3px ${GREEN}33` : "none" }} />
          {live ? "En direct" : "En pause"}
          <span style={{ color: MUTED, fontSize: 11 }}>
            {updatedAt ? `· ${updatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </span>
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon={RefreshCw} onClick={load}>Actualiser</Btn>
          <Btn icon={FileText} onClick={() => doExport("pdf")} disabled={busy}>{busy === "pdf" ? "…" : "PDF"}</Btn>
          <Btn icon={Sheet} onClick={() => doExport("xls")} disabled={busy}>{busy === "xls" ? "…" : "Excel"}</Btn>
        </div>
      </div>

      {/* Affluence en direct */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
            <DoorOpen size={16} color={P} /> Affluence en direct
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: over ? "#DC2626" : DARK }}>
            {fmtInt(arrived)}{cap != null ? ` / ${fmtInt(cap)}` : ""} pers.
          </div>
        </div>
        {cap != null ? (
          <>
            <div style={{ height: 12, borderRadius: 8, background: BG, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: over ? "#DC2626" : GREEN, borderRadius: 8, transition: "width .4s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5, color: MUTED }}>
              <span>{over ? `${fmtInt(c.paid_entries)} au-delà de la jauge (payants)` : `${fmtInt(c.free_remaining)} entrées gratuites restantes`}</span>
              <span>{pct}%</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: MUTED }}>Définissez la jauge d'entrées dans « Détails » pour suivre l'affluence et les entrées payantes.</div>
        )}
      </Card>

      {/* Réconciliation caisse */}
      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <Wallet size={16} color={P} /> Réconciliation caisse
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          {stat("Entrées payantes", fmtInt(c.paid_entries), over ? "#DC2626" : DARK, c.entry_price ? `× ${fmt(c.entry_price)}` : "prix non défini")}
          {stat("Espèces entrées", fmt(c.entry_cash_due), "#C47D1A", "à encaisser à la porte")}
          {stat("Bar encaissé", fmt(c.bar_cashed), GREEN, `${fmtInt(o.n_paid)} cmd payées`)}
          {stat("Bar en attente", fmt(c.bar_pending), MUTED, `${fmtInt((o.n_pending || 0) + (o.n_served || 0))} cmd`)}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FEF6EC",
          border: "0.5px solid #F3E4CB", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#7a5a1a" }}>Total espèces attendu (entrées + bar encaissé)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#C47D1A" }}>{fmt(c.total_expected)}</div>
        </div>
      </Card>

      {/* Chiffres clés */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat("Réservations", fmtInt(r.total))}
        {stat("Confirmées", fmtInt(r.confirmed), GREEN)}
        {stat("Arrivées", fmtInt(r.checked_in), P, `${fmtInt(arrived)} pers.`)}
        {stat("Packs VIP", fmtInt(v.vip_sold), DARK, fmt(v.vip_revenue))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 12 }}>
        {/* Performance serveurs (Phase 4) */}
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <TrendingUp size={15} color={P} /> Performance serveurs
          </div>
          {servers.length === 0 ? <Empty text="Aucun serveur assigné." /> :
            servers.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", background: "#fafafa", borderRadius: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: MUTED, width: 14 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: DARK, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 10.5, color: MUTED }}>{fmtInt(s.tables_count)} table(s) · {fmtInt(s.orders_count)} cmd</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{fmt(s.revenue)}</div>
                  <div style={{ fontSize: 10.5, color: GREEN }}>{fmt(s.cashed)} encaissé</div>
                </div>
              </div>
            ))}
        </Card>
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 10 }}>Top bouteilles</div>
          {(d.top_bottles || []).length === 0 ? <Empty /> :
            d.top_bottles.map((b, i) => <RowLine key={i} label={b.name} value={`${b.qty}`} rank={i + 1} />)}
        </Card>
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 10 }}>Promoteurs</div>
          {(d.promoters || []).length === 0 ? <Empty /> :
            d.promoters.map((p, i) => <RowLine key={i} label={`${p.name} · ${p.code}`} value={`${p.reservations} résa`} rank={i + 1} />)}
        </Card>
      </div>
    </div>
  );
}

// ═══ BOUTEILLES (carte + config + QR par table) ═══════════════════════════════
export function BottlesTab({ event, tables, onChanged }) {
  const [bottles, setBottles] = useState([]);
  const [enabled, setEnabled] = useState(event.bottles_enabled !== false && event.bottles_enabled === true);
  const [mode, setMode] = useState(event.ordering_mode || "per_order");
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({ name: "", category: "Bouteilles", price: 0, description: "" });
  const [qrTable, setQrTable] = useState(null);
  const load = () => eventsService.listBottles(event.id).then(d => setBottles(d?.bottles || [])).catch(console.error);
  useEffect(() => { load(); setEnabled(event.bottles_enabled === true); setMode(event.ordering_mode || "per_order"); }, [event.id]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const saveConfig = async (patch) => { try { await eventsService.update(event.id, patch); onChanged?.(); } catch { alert("Erreur"); } };
  const toggleEnabled = (v) => { setEnabled(v); saveConfig({ bottles_enabled: v }); };
  const changeMode = (m) => { setMode(m); saveConfig({ ordering_mode: m }); };

  const openNew = () => { setEdit(null); setF({ name: "", category: "Bouteilles", price: 0, description: "" }); setModal(true); };
  const openEdit = (b) => { setEdit(b); setF({ name: b.name, category: b.category, price: b.price, description: b.description || "" }); setModal(true); };
  const save = async () => {
    if (!f.name) return;
    const payload = { ...f, price: Number(f.price) || 0 };
    try { edit ? await eventsService.updateBottle(event.id, edit.id, payload) : await eventsService.createBottle(event.id, payload); setModal(false); load(); }
    catch { alert("Erreur"); }
  };
  const del = async (b) => { if (!window.confirm(`Retirer « ${b.name} » ?`)) return; try { await eventsService.deleteBottle(event.id, b.id); load(); } catch { alert("Erreur"); } };

  const activeTables = (tables || []).filter(t => t.is_active);
  const carteUrl = (t) => `${window.location.origin}/evenement/${event.slug}/carte${t ? `?table=${t.id}&label=${encodeURIComponent(t.label)}` : ""}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Config */}
      <Card>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <Toggle value={enabled} onChange={toggleEnabled} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>
            Commande de bouteilles {enabled ? "activée" : "désactivée"}
          </span>
        </label>
        <div style={{ fontSize: 12, color: MUTED, margin: "6px 0 12px" }}>
          Les invités scannent le QR de leur table pour commander. Paiement <strong>cash sur place</strong>.
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Mode de paiement</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["per_order", "À la commande"], ["tab", "Note en fin de soirée"]].map(([k, label]) => (
            <button key={k} onClick={() => changeMode(k)}
              style={{ flex: 1, border: `1.5px solid ${mode === k ? P : BORDER}`, borderRadius: 10, padding: "10px 0",
                background: mode === k ? "#FEF6EC" : "white", cursor: "pointer", fontFamily: FONT,
                color: mode === k ? "#C47D1A" : DARK, fontSize: 13, fontWeight: 600 }}>{label}</button>
          ))}
        </div>
      </Card>

      {/* Carte */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
            <Wine size={16} color={P} /> Carte des bouteilles
          </div>
          <Btn variant="primary" icon={Plus} onClick={openNew}>Ajouter</Btn>
        </div>
        {bottles.length === 0 ? <Empty text="Aucune bouteille. Ajoutez votre carte." /> : (
          <div style={{ display: "grid", gap: 8 }}>
            {bottles.map(b => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `0.5px solid ${BORDER}`, borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{b.name} <span style={{ fontSize: 11, color: MUTED }}>· {b.category}</span></div>
                  {b.description && <div style={{ fontSize: 11.5, color: MUTED }}>{b.description}</div>}
                </div>
                <div style={{ fontWeight: 700, color: P, fontSize: 14 }}>{fmt(b.price)}</div>
                <button onClick={() => openEdit(b)} style={iconBtn}><Pencil size={14} color={MUTED} /></button>
                <button onClick={() => del(b)} style={iconBtn}><Trash2 size={14} color="#DC2626" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR par table */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
          <QrCode size={16} color={P} /> QR de commande par table
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
          Imprimez et posez le QR sur chaque table. Le QR général (sans table) est aussi disponible.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setQrTable({ label: "Général", id: null })} style={qrChip}>Général</button>
          {activeTables.map(t => (
            <button key={t.id} onClick={() => setQrTable(t)} style={qrChip}>{t.label}</button>
          ))}
          {activeTables.length === 0 && <span style={{ fontSize: 12.5, color: MUTED }}>Ajoutez des tables dans « Plan & Tables ».</span>}
        </div>
      </Card>

      {qrTable && (
        <Modal open title={`QR — ${qrTable.label}`} onClose={() => setQrTable(null)} width={320}>
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "white", padding: 14, display: "inline-block", borderRadius: 10, border: `0.5px solid ${BORDER}` }}>
              <QRCode value={carteUrl(qrTable.id ? qrTable : null)} size={180} fgColor={DARK} />
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 10, wordBreak: "break-all" }}>{carteUrl(qrTable.id ? qrTable : null)}</div>
            <div style={{ fontSize: 12, color: DARK, marginTop: 6 }}>Scannez pour commander à « {qrTable.label} »</div>
          </div>
        </Modal>
      )}

      <Modal open={modal} title={edit ? "Modifier" : "Nouvelle bouteille"} onClose={() => setModal(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Nom"><Input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Moët & Chandon" /></FormField>
          <FormField label="Catégorie"><Input value={f.category} onChange={e => set("category", e.target.value)} placeholder="Champagne" /></FormField>
        </div>
        <FormField label="Prix (FCFA)"><Input type="number" value={f.price} onChange={e => set("price", e.target.value)} placeholder="75000" /></FormField>
        <FormField label="Description (optionnel)"><Input value={f.description} onChange={e => set("description", e.target.value)} placeholder="75cl, brut" /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={save} disabled={!f.name}>{edit ? "Enregistrer" : "Ajouter"}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══ PROMOTEURS ════════════════════════════════════════════════════════════════
export function PromotersTab({ event }) {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: "", code: "" });
  const load = () => eventsService.listPromoters(event.id).then(d => setList(d?.promoters || [])).catch(console.error);
  useEffect(() => { load(); }, [event.id]);
  const create = async () => {
    if (!f.name) return;
    try { await eventsService.createPromoter(event.id, f); setModal(false); setF({ name: "", code: "" }); load(); }
    catch (e) { alert(e.response?.data?.message || "Erreur"); }
  };
  const del = async (p) => { if (!window.confirm(`Retirer ${p.name} ?`)) return; try { await eventsService.deletePromoter(event.id, p.id); load(); } catch { alert("Erreur"); } };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
          <Megaphone size={16} color={P} /> Codes promoteurs
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => setModal(true)}>Ajouter</Btn>
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        Les invités saisissent le code à la réservation → entrées attribuées au promoteur.
      </div>
      {list.length === 0 ? <Empty text="Aucun promoteur." /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {list.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `0.5px solid ${BORDER}`, borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{p.name}</div>
                <div style={{ fontSize: 12, color: P, fontFamily: "monospace", fontWeight: 700 }}>{p.code}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{p.reservations}</div>
                <div style={{ fontSize: 10.5, color: MUTED }}>résa · {p.covers} couv.</div>
              </div>
              <button onClick={() => del(p)} style={iconBtn}><Trash2 size={14} color="#DC2626" /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} title="Nouveau promoteur" onClose={() => setModal(false)}>
        <FormField label="Nom du promoteur"><Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="DJ Koffi" /></FormField>
        <FormField label="Code (optionnel — auto sinon)"><Input value={f.code} onChange={e => setF(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="KOFFI" /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={create} disabled={!f.name}>Ajouter</Btn>
        </div>
      </Modal>
    </Card>
  );
}

// ═══ STAFF ═════════════════════════════════════════════════════════════════════
export function StaffTab({ event, tables = [], onChanged }) {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: "", role: "all" });
  const [assignBusy, setAssignBusy] = useState(null);
  const load = () => eventsService.listStaff(event.id).then(d => setList(d?.staff || [])).catch(console.error);
  useEffect(() => { load(); }, [event.id]);
  const create = async () => { if (!f.name) return; try { await eventsService.createStaff(event.id, f); setModal(false); setF({ name: "", role: "all" }); load(); } catch { alert("Erreur"); } };
  const del = async (s) => { if (!window.confirm(`Retirer ${s.name} ?`)) return; try { await eventsService.deleteStaff(event.id, s.id); load(); } catch { alert("Erreur"); } };
  const staffUrl = `${window.location.origin}/staff`;
  const roleLabel = { all: "Tout", checkin: "Check-in", bar: "Bar", serveur: "Serveur", caisse: "Caisse" };
  const servers = list.filter(s => s.role === "serveur" || s.role === "all");
  const assign = async (tableId, serverId) => {
    setAssignBusy(tableId);
    try { await eventsService.updateTable(event.id, tableId, { server_id: serverId || "none" }); onChanged && await onChanged(); }
    catch { alert("Erreur lors de l'assignation"); }
    finally { setAssignBusy(null); }
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
          <Users size={16} color={P} /> Équipe (comptes staff)
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => setModal(true)}>Ajouter</Btn>
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, background: BG, borderRadius: 8, padding: "8px 12px" }}>
        Le staff se connecte sur <strong>{staffUrl}</strong> avec le code événement <strong>{event.slug}</strong> + son PIN.
      </div>
      {list.length === 0 ? <Empty text="Aucun staff." /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {list.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `0.5px solid ${BORDER}`, borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{s.name}</div>
                <Badge label={roleLabel[s.role] || s.role} variant="gray" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: P, fontFamily: "monospace", letterSpacing: 2 }}>{s.pin}</div>
              <button onClick={() => del(s)} style={iconBtn}><Trash2 size={14} color="#DC2626" /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} title="Nouveau staff" onClose={() => setModal(false)}>
        <FormField label="Nom"><Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Awa (accueil)" /></FormField>
        <FormField label="Rôle">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["all", "Tout"], ["checkin", "Check-in"], ["bar", "Bar"], ["serveur", "Serveur"], ["caisse", "Caisse"]].map(([k, label]) => (
              <button key={k} onClick={() => setF(p => ({ ...p, role: k }))}
                style={{ flex: 1, minWidth: 78, border: `1.5px solid ${f.role === k ? P : BORDER}`, borderRadius: 10, padding: "9px 0",
                  background: f.role === k ? "#FEF6EC" : "white", cursor: "pointer", fontFamily: FONT, color: f.role === k ? "#C47D1A" : DARK, fontSize: 13, fontWeight: 600 }}>{label}</button>
            ))}
          </div>
        </FormField>
        <div style={{ fontSize: 12, color: MUTED }}>Un PIN sera généré automatiquement.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={create} disabled={!f.name}>Ajouter</Btn>
        </div>
      </Modal>

      {/* Assignation serveur ↔ table (Phase 3) */}
      <div style={{ marginTop: 22, borderTop: `0.5px solid ${BORDER}`, paddingTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Armchair size={16} color={P} /> Assignation des tables
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
          Attribuez chaque table à un serveur. Le serveur ne verra et ne commandera que pour <strong>ses</strong> tables.
        </div>
        {servers.length === 0 ? (
          <Empty text="Créez d'abord un staff avec le rôle « Serveur » pour pouvoir assigner des tables." />
        ) : tables.length === 0 ? (
          <Empty text="Ajoutez des tables dans l'onglet « Plan & Tables »." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {tables.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", border: `0.5px solid ${BORDER}`, borderRadius: 10 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: DARK, fontWeight: 600 }}>
                  {t.kind === "vip" ? <Crown size={13} color={P} /> : <Armchair size={13} color={MUTED} />} {t.label}
                </div>
                <select value={t.server_id || ""} disabled={assignBusy === t.id}
                  onChange={e => assign(t.id, e.target.value)}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 10px", fontFamily: FONT,
                    fontSize: 13, color: t.server_id ? DARK : MUTED, background: "white", cursor: "pointer", maxWidth: 180 }}>
                  <option value="">— Aucun serveur —</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ═══ CHECK-IN ══════════════════════════════════════════════════════════════════
// ── Mini-plan : situe la table d'un salon (lecture seule, auto-cadré) ─────────
function TablePlanMini({ tables, highlightId, onClose }) {
  const list = (tables || []).map(t => ({
    ...t,
    x: t.pos_x ?? 20, y: t.pos_y ?? 20,
    w: t.kind === "vip" ? 104 : (t.capacity || 2) <= 2 ? 74 : (t.capacity || 2) <= 4 ? 90 : 104,
    h: t.kind === "vip" ? 78 : (t.capacity || 2) <= 2 ? 62 : 74,
  }));
  const target = list.find(t => String(t.id) === String(highlightId));
  // Cadrage : bornes de toutes les tables
  const pad = 24;
  const minX = Math.min(...list.map(t => t.x), 0) - pad;
  const minY = Math.min(...list.map(t => t.y), 0) - pad;
  const maxX = Math.max(...list.map(t => t.x + t.w), 200) + pad;
  const maxY = Math.max(...list.map(t => t.y + t.h), 160) + pad;
  const worldW = maxX - minX, worldH = maxY - minY;
  const viewW = 320, scale = Math.min(1, viewW / worldW);
  const viewH = Math.max(180, worldH * scale);

  return (
    <Modal open title="Emplacement de la table" width={368} onClose={onClose}>
      {target ? (
        <div style={{ fontSize: 13, color: DARK, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={15} color={P} />
          <strong>{target.label}</strong>
          {target.zone && target.zone !== "general" ? <span style={{ color: MUTED }}>· zone {target.zone}</span> : null}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 10 }}>Aucune table attribuée à ce salon.</div>
      )}
      <div style={{ position: "relative", width: viewW, height: viewH, margin: "0 auto",
        background: "linear-gradient(135deg,#FbF9F5,#F2EEE6)", border: `0.5px solid ${BORDER}`,
        borderRadius: 12, overflow: "hidden" }}>
        {list.map(t => {
          const on = target && String(t.id) === String(target.id);
          return (
            <div key={t.id} style={{ position: "absolute",
              left: (t.x - minX) * scale, top: (t.y - minY) * scale,
              width: t.w * scale, height: t.h * scale,
              borderRadius: t.kind === "vip" ? 8 : 6,
              background: on ? P : (t.kind === "vip" ? "#F3E4CB" : "white"),
              border: `${on ? 2 : 1}px solid ${on ? DARK : BORDER}`,
              boxShadow: on ? `0 0 0 4px ${P}55, 0 6px 16px rgba(0,0,0,.18)` : "0 1px 3px rgba(0,0,0,.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: on ? 5 : 1, transition: "box-shadow .2s" }}>
              <span style={{ fontSize: Math.max(7, 10 * scale), fontWeight: 800,
                color: on ? "white" : DARK, fontFamily: FONT, textAlign: "center",
                overflow: "hidden", whiteSpace: "nowrap" }}>{t.label}</span>
            </div>
          );
        })}
        {target && (
          <div style={{ position: "absolute", left: (target.x - minX) * scale + (target.w * scale) / 2 - 9,
            top: (target.y - minY) * scale - 20, zIndex: 6, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" }}>
            <MapPin size={19} color={P} fill={P} />
          </div>
        )}
      </div>
      <Btn variant="ghost" onClick={onClose} style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>Fermer</Btn>
    </Modal>
  );
}

// ── Onglet Commandes (organisateur + staff bar/caisse) ───────────────────────
// Reçoit les commandes des salons en temps réel (polling 20 s) et permet de les
// faire évoluer : en attente → servi → payé (ou annulé).
const ORDER_STATUS = {
  en_attente: { label: "En attente", color: "#854F0B", bg: "#FAEEDA" },
  servi:      { label: "Servi",      color: GREEN,     bg: "#F0F6F2" },
  paye:       { label: "Payé",       color: "#185FA5", bg: "#E6F1FB" },
  annule:     { label: "Annulé",     color: "#993C1D", bg: "#FAECE7" },
};
const oBtn = (c) => ({ border: "none", borderRadius: 8, padding: "7px 13px", background: c, color: "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT });
const oGhost = { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 13px", background: "white", color: "#993C1D", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT };

export function OrdersTab({ eventId, staffToken, onAuthError }) {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("actives"); // actives | toutes
  const [sound, setSound] = useState(() => localStorage.getItem("tci_order_sound") !== "off");
  const seenRef = useRef(null);
  const soundRef = useRef(sound); soundRef.current = sound;
  const load = () => eventOpsService.listOrders(eventId, staffToken).then(d => {
    const list = d?.orders || [];
    const ids = new Set(list.map(o => o.id));
    if (seenRef.current === null) { seenRef.current = ids; }
    else {
      const hasNew = list.some(o => !seenRef.current.has(o.id) && o.status === "en_attente");
      seenRef.current = ids;
      if (hasNew && soundRef.current) playOrderAlarm();
    }
    setOrders(list);
  }).catch(e => { if (!onAuthError?.(e)) console.error(e); });
  // Rafraîchi souvent (8 s) → commandes visibles quasi en temps réel
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [eventId]);
  const toggleSound = () => { const v = !sound; setSound(v); localStorage.setItem("tci_order_sound", v ? "on" : "off"); unlockAudio(); if (v) playOrderAlarm(); };
  const setStatus = async (o, status) => {
    try { await eventOpsService.setOrderStatus(o.id, status, staffToken, eventId); load(); }
    catch (e) { if (!onAuthError?.(e)) alert(e.response?.data?.message || "Erreur"); }
  };
  if (!orders) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;
  const pending = orders.filter(o => o.status === "en_attente");
  const paid = orders.filter(o => o.status === "paye");
  const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);
  const shown = filter === "actives" ? orders.filter(o => o.status === "en_attente" || o.status === "servi") : orders;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          ["En attente", pending.length, pending.length ? "#854F0B" : DARK, "à servir"],
          ["Encaissé", fmt(revenue), GREEN, `${paid.length} payée${paid.length > 1 ? "s" : ""}`],
          ["Total commandes", orders.length, DARK, ""],
        ].map(([l, v, c, sub], i) => (
          <div key={i} style={{ flex: 1, minWidth: 110, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ fontSize: 11.5, color: MUTED }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            {sub && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {[["actives", "Actives"], ["toutes", "Toutes"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ border: `1px solid ${filter === k ? P : BORDER}`, background: filter === k ? "#FEF6EC" : "white",
              color: filter === k ? "#8a5a10" : MUTED, borderRadius: 9, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>{l}</button>
        ))}
        <button onClick={toggleSound} title={sound ? "Alerte sonore activée" : "Alerte sonore coupée"}
          style={{ marginLeft: "auto", border: `1px solid ${sound ? P : BORDER}`, background: sound ? "#FEF6EC" : "white", borderRadius: 9, padding: "6px 12px",
            cursor: "pointer", color: sound ? "#8a5a10" : MUTED, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, fontFamily: FONT }}>
          {sound ? <Bell size={13} /> : <BellOff size={13} />} Son
        </button>
        <button onClick={load} title="Rafraîchir"
          style={{ border: `1px solid ${BORDER}`, background: "white", borderRadius: 9, padding: "6px 12px",
            cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontFamily: FONT }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {shown.map(o => {
          const st = ORDER_STATUS[o.status] || ORDER_STATUS.en_attente;
          const items = Array.isArray(o.items) ? o.items : [];
          return (
            <div key={o.id} style={{ border: `0.5px solid ${BORDER}`, borderRadius: 11, background: "white", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: DARK, fontFamily: "monospace" }}>{o.ref}</span>
                  {o.table_label && <span style={{ fontSize: 12, color: MUTED, display: "inline-flex", alignItems: "center", gap: 3 }}>{o.table_kind === "vip" && <Crown size={12} color={P} />}{o.table_label}</span>}
                  {o.server_name && <span style={{ fontSize: 11.5, color: MUTED }}>· {o.server_name}</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 10px", borderRadius: 20 }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#4a5a52", marginBottom: 6 }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}><span>{it.qty}× {it.name}</span><span>{fmt(it.price * it.qty)}</span></div>
                ))}
              </div>
              {o.guest_name && <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>{o.guest_name}</div>}
              {o.note && <div style={{ fontSize: 11.5, color: MUTED, fontStyle: "italic", marginBottom: 4 }}>« {o.note} »</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: P }}>{fmt(o.total)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {o.status === "en_attente" && <button onClick={() => setStatus(o, "servi")} style={oBtn(GREEN)}>Servi</button>}
                  {(o.status === "en_attente" || o.status === "servi") && <button onClick={() => setStatus(o, "paye")} style={oBtn("#185FA5")}>Payé</button>}
                  {o.status !== "annule" && o.status !== "paye" && <button onClick={() => setStatus(o, "annule")} style={oGhost}>Annuler</button>}
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <Empty text="Aucune commande pour le moment. Les commandes des salons apparaîtront ici en temps réel." />}
      </div>
    </div>
  );
}

export function CheckinTab({ eventId, staffToken, onAuthError }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);   // réservation dépliée
  const [scanning, setScanning] = useState(false);
  const [confirm, setConfirm] = useState(null); // { resa, count, byScan }
  const [pinResult, setPinResult] = useState(null); // { pin, name, table } après check-in
  const [planTable, setPlanTable] = useState(null); // id de table à situer sur le plan
  const [busy, setBusy] = useState(false);
  const load = () => eventOpsService.listCheckin(eventId, staffToken).then(setData).catch(e => { if (!onAuthError?.(e)) console.error(e); });
  // Rafraîchi en continu (10 s) → toutes les bornes d'entrée voient les arrivées
  // des autres en temps réel (compteurs, statut « arrivé », salons déjà pointés).
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [eventId]);

  // QR scanné → on isole la réf (EVT-1234) et on ouvre la confirmation d'arrivée
  const onScan = (text) => {
    setScanning(false);
    const m = String(text).match(/EVT-\d+/i);
    const ref = (m ? m[0] : String(text).trim()).toUpperCase();
    const resa = (data?.reservations || []).find(r => (r.ref || "").toUpperCase() === ref);
    if (!resa) { alert(`Réservation « ${ref} » introuvable pour cet événement.`); return; }
    if (resa.checked_in_at) { alert(`${resa.client_name || ref} est déjà pointé(e) comme arrivé(e).`); return; }
    setConfirm({ resa, count: resa.party_size || 1, byScan: true });
  };

  const doConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const r = confirm.byScan
        ? await eventOpsService.checkinByRef(confirm.resa.ref, staffToken, eventId, confirm.count)
        : await eventOpsService.checkin(confirm.resa.id, false, staffToken, eventId, confirm.count);
      const pin = r?.reservation?.order_pin;
      const info = { pin, name: confirm.resa.client_name, table: confirm.resa.table_label, table_id: confirm.resa.table_id, phone: confirm.resa.client_phone };
      const wasTopup = confirm.topup;
      setConfirm(null); await load();
      // Lors d'un simple complément d'arrivées, on ne ré-affiche pas le code
      // (déjà remis à la 1re arrivée). Sinon on affiche le code du responsable.
      if (pin && !wasTopup) setPinResult(info);
    } catch (e) { if (!onAuthError?.(e)) alert(e.response?.data?.message || "Erreur"); }
    finally { setBusy(false); }
  };
  const undo = async (r) => { try { await eventOpsService.checkin(r.id, true, staffToken, eventId); load(); } catch (e) { if (!onAuthError?.(e)) alert(e.response?.data?.message || "Erreur"); } };

  // Revoir le code d'une arrivée déjà pointée (si le responsable l'a perdu)
  const openCode = (r) => setPinResult({ pin: r.order_pin, name: r.client_name, table: r.table_label, table_id: r.table_id, phone: r.client_phone });

  // Lien WhatsApp (wa.me) pré-rempli avec le code + le lien de la carte du salon
  const waLink = (info) => {
    const phone = waPhone(info?.phone);   // format international 225… requis par wa.me
    if (!phone || !info?.pin) return null;
    const slug = data?.event?.slug;
    const carte = slug ? `${window.location.origin}/evenement/${slug}/carte` : "";
    const evName = data?.event?.name || "l'événement";
    const msg =
      `Bonjour ${info.name || ""}, voici votre code d'accès à la carte des bouteilles pour ${evName}` +
      (info.table ? ` (salon ${info.table})` : "") + ` :\n\n` +
      `🔑 Code : ${info.pin}\n` +
      (carte ? `📲 Commandez ici : ${carte}\n` : "") +
      `\nEntrez ce code à 4 chiffres pour accéder à la carte et commander.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  if (!data) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;
  const t = data.totals || {};
  const remaining = t.remaining != null ? t.remaining : (t.capacity != null ? Math.max(0, (t.capacity || 0) - (t.arrived_covers || 0)) : null);
  const list = (data.reservations || []).filter(r => {
    const s = q.trim().toLowerCase(); if (!s) return true;
    return (r.client_name || "").toLowerCase().includes(s) || (r.ref || "").toLowerCase().includes(s) || (r.table_label || "").toLowerCase().includes(s);
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Compteurs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          ["Arrivés (pers.)", fmtInt(t.arrived_covers), GREEN, `${t.arrived || 0}/${t.total || 0} résa`],
          remaining != null
            ? ["Entrées gratuites restantes", fmtInt(remaining), remaining === 0 ? "#DC2626" : P, remaining === 0 ? "surplus → caisse espèces" : `jauge ${fmtInt(t.capacity)}`]
            : ["Attendus (pers.)", fmtInt(t.covers), P, `${fmtInt(t.total)} réservations`],
          ["Couverts attendus", fmtInt(t.covers), DARK, ""],
        ].map(([l, v, c, sub], i) => (
          <div key={i} style={{ flex: 1, minWidth: 110, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ fontSize: 11.5, color: MUTED }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            {sub && <div style={{ fontSize: 10.5, color: c === "#DC2626" ? "#DC2626" : MUTED, marginTop: 1 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Scanner + recherche */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setScanning(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, border: "none", borderRadius: 11, padding: "11px 18px",
            background: DARK, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, touchAction: "manipulation" }}>
          <QrCode size={17} /> Scanner un QR
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", background: "white", flex: 1, minWidth: 200 }}>
          <Search size={15} color={MUTED} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, réf (EVT-…) ou table…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: 13, color: DARK, fontFamily: FONT, background: "transparent" }} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {list.map(r => {
          const arrived = !!r.checked_in_at;
          const isOpen = open === r.id;
          const pax = r.arrived_size != null ? r.arrived_size : r.party_size;
          return (
            <div key={r.id} style={{ borderRadius: 10, border: `0.5px solid ${arrived ? GREEN + "55" : BORDER}`, background: arrived ? "#F0F6F2" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : r.id)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{r.client_name || "Client"}</div>
                  <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace" }}>{r.ref}</span>
                    <span>{r.party_size} pers.</span>
                    {r.table_label && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {r.table_kind === "vip" && <Crown size={12} color={P} />}{r.table_label}</span>}
                    {r.promoter_code && <span>promo {r.promoter_code}</span>}
                    <span style={{ color: P, display: "inline-flex", alignItems: "center", gap: 2 }}>
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} détail</span>
                  </div>
                </div>
                {arrived ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.order_pin && (
                      <button onClick={() => openCode(r)} title="Revoir le code du responsable"
                        style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 11px",
                          background: "white", color: P, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                        <KeyRound size={14} /> Code
                      </button>
                    )}
                    <button onClick={() => undo(r)}
                      style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 8, padding: "8px 13px",
                        background: "#e8e8e8", color: DARK, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                      <X size={14} /> Annuler
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirm({ resa: r, count: r.party_size || 1, byScan: false })}
                    style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 8, padding: "8px 13px",
                      background: GREEN, color: "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    <Check size={14} /> Arrivé
                  </button>
                )}
              </div>
              {isOpen && (
                <div style={{ padding: "0 13px 12px", fontSize: 12.5, color: "#4a5a52", display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={13} color={MUTED} /> Réservé <strong>{r.party_size}</strong> · arrivés <strong>{arrived ? pax : "—"}</strong>
                      {arrived && pax < r.party_size && <span style={{ color: P, fontWeight: 700 }}>· reste {r.party_size - pax}</span>}
                    </span>
                    {arrived && pax < r.party_size && (
                      <button onClick={() => setConfirm({ resa: r, count: pax, byScan: false, topup: true })}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${P}`, borderRadius: 7,
                          padding: "3px 9px", background: "#FEF6EC", cursor: "pointer", fontFamily: FONT, fontSize: 11.5, color: "#8a5a10", fontWeight: 700 }}>
                        <UserPlus size={12} /> Compléter les arrivées
                      </button>
                    )}</div>
                  {r.table_label && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {r.table_kind === "vip" ? <Crown size={13} color={P} /> : <Armchair size={13} color={MUTED} />} {r.table_label}{r.table_price ? ` · ${fmt(r.table_price)}` : ""}
                    {r.table_id && <button onClick={() => setPlanTable(r.table_id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${BORDER}`, borderRadius: 7,
                        padding: "2px 8px", background: "white", cursor: "pointer", fontFamily: FONT, fontSize: 11.5, color: P, fontWeight: 600 }}>
                      <MapPin size={12} /> Voir sur plan</button>}</div>}
                  {r.client_phone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={13} color={MUTED} /> {r.client_phone}</div>}
                  {r.promoter_code && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Megaphone size={13} color={MUTED} /> promoteur : {r.promoter_code}</div>}
                  {r.special_request && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><FileText size={13} color={MUTED} /> « {r.special_request} »</div>}
                  {arrived && <div style={{ display: "flex", alignItems: "center", gap: 6, color: GREEN }}>
                    <Check size={13} /> Arrivé{r.checked_in_at ? ` à ${new Date(r.checked_in_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <Empty text="Aucune réservation confirmée. Confirmez les réservations dans l'onglet « Réservations » pour qu'elles apparaissent ici." />}
      </div>

      {scanning && <QrScanner onScan={onScan} onClose={() => setScanning(false)} />}

      {/* Emplacement de la table sur le plan */}
      {planTable && (
        <TablePlanMini tables={data.tables} highlightId={planTable} onClose={() => setPlanTable(null)} />
      )}

      {/* Confirmation d'arrivée : saisie du nombre réel de personnes */}
      {confirm && (
        <Modal open title={confirm.topup ? "Compléter les arrivées" : "Confirmer l'arrivée"} width={360} onClose={() => setConfirm(null)}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{confirm.resa.client_name || "Client"}</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            <span style={{ fontFamily: "monospace" }}>{confirm.resa.ref}</span>
            {confirm.resa.table_label ? ` · ${confirm.resa.table_label}` : ""} · réservé {confirm.resa.party_size} pers.
          </div>
          {confirm.topup && (
            <div style={{ fontSize: 12, color: "#8a5a10", background: "#FEF6EC", border: `1px solid ${P}55`, borderRadius: 8,
              padding: "8px 11px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <UserPlus size={13} /> Saisissez le <strong>total</strong> de personnes maintenant arrivées (le code du salon reste le même).
            </div>
          )}
          {confirm.resa.table_id && (
            <button onClick={() => setPlanTable(confirm.resa.table_id)}
              style={{ ...qrChip, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <MapPin size={14} color={P} /> Voir la table sur le plan
            </button>
          )}
          {(() => {
            const party = confirm.resa.party_size || 1;
            const physCap = confirm.resa.table_capacity || 0;
            // Plafond = nombre RÉSERVÉ (borné par la capacité physique si plus petite).
            const resaMax = physCap > 0 ? Math.min(party, physCap) : party;
            const atMax = confirm.count >= resaMax;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "1px" }}>
                    Personnes réellement arrivées
                  </div>
                  <span style={{ fontSize: 11, color: MUTED }}>Max réservé : {resaMax}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 8 }}>
                  <button onClick={() => setConfirm(c => ({ ...c, count: Math.max(1, c.count - 1) }))} style={stepBtn}>−</button>
                  <span style={{ fontSize: 30, fontWeight: 800, color: atMax ? "#DC2626" : DARK, minWidth: 44, textAlign: "center" }}>{confirm.count}</span>
                  <button onClick={() => setConfirm(c => ({ ...c, count: Math.min(resaMax, c.count + 1) }))}
                    disabled={atMax} style={{ ...stepBtn, opacity: atMax ? 0.4 : 1, cursor: atMax ? "default" : "pointer" }}>+</button>
                </div>
                {atMax && (
                  <div style={{ fontSize: 11.5, color: "#8a5a10", textAlign: "center", marginBottom: 10, display: "flex",
                    alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <AlertTriangle size={13} /> Nombre réservé atteint ({resaMax} pers.)
                  </div>
                )}
              </>
            );
          })()}
          {remaining != null ? (
            <div style={{ fontSize: 11.5, color: confirm.count > remaining ? "#DC2626" : MUTED, textAlign: "center",
              marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              {confirm.count > remaining
                ? <><AlertTriangle size={13} /> {confirm.count - remaining} au-delà de la jauge — surplus payant en caisse</>
                : `Entrées gratuites restantes après : ${remaining - confirm.count}`}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, textAlign: "center", marginBottom: 14 }}>
              Astuce : renseignez la « jauge d'entrées » dans l'onglet Détails pour suivre les entrées gratuites restantes.
            </div>
          )}
          <Btn variant="primary" icon={Check} onClick={doConfirm} disabled={busy}
            style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "…" : (confirm.topup ? "Mettre à jour" : "Confirmer l'arrivée")}
          </Btn>
        </Modal>
      )}

      {/* Code responsable généré au check-in (à remettre au responsable du salon) */}
      {pinResult && (
        <Modal open title="Arrivée confirmée" width={340} onClose={() => setPinResult(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Check size={30} color={GREEN} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>
              {pinResult.name || "Client"}{pinResult.table ? ` · ${pinResult.table}` : ""}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
              letterSpacing: "1px", marginTop: 18, marginBottom: 6 }}>
              Code du responsable de salon
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 10, color: DARK,
              fontFamily: "monospace", marginBottom: 12 }}>{pinResult.pin}</div>
            <div style={{ fontSize: 12.5, color: "#4a5a52", lineHeight: 1.55, marginBottom: 14 }}>
              Remettez ce code au responsable du salon. Il en aura besoin pour <strong>passer les commandes</strong> via le QR de sa table.
            </div>
            {waLink(pinResult) && (
              <a href={waLink(pinResult)} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
                  textDecoration: "none", boxSizing: "border-box", borderRadius: 11, padding: "12px",
                  background: "#25D366", color: "white", fontSize: 14, fontWeight: 700, fontFamily: FONT, marginBottom: 8 }}>
                <MessageCircle size={16} /> Envoyer le code par WhatsApp
              </a>
            )}
            {pinResult.table_id && (
              <Btn variant="ghost" icon={MapPin} onClick={() => setPlanTable(pinResult.table_id)}
                style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}>
                Voir la table sur le plan
              </Btn>
            )}
            <Btn variant="primary" onClick={() => setPinResult(null)} style={{ width: "100%", justifyContent: "center" }}>Terminé</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const stepBtn = { width: 46, height: 46, borderRadius: "50%", border: `1.5px solid ${BORDER}`, background: "white",
  fontSize: 24, fontWeight: 700, color: DARK, cursor: "pointer", fontFamily: FONT, touchAction: "manipulation" };

const iconBtn = { border: "none", background: "transparent", cursor: "pointer", padding: 4, display: "flex" };
const qrChip = { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", background: "white", cursor: "pointer", fontFamily: FONT, fontSize: 13, color: DARK, fontWeight: 600 };
const Empty = ({ text = "Aucune donnée." }) => <div style={{ textAlign: "center", padding: "26px 0", color: MUTED, fontSize: 12.5 }}>{text}</div>;
function RowLine({ label, value, rank }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", background: "#fafafa", borderRadius: 8, marginBottom: 5 }}>
      {rank && <span style={{ fontSize: 11, color: MUTED, width: 14 }}>{rank}</span>}
      <span style={{ flex: 1, fontSize: 12.5, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{value}</span>
    </div>
  );
}
