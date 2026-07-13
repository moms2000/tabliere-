import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  Wine, Plus, Pencil, Trash2, Crown, Armchair, Megaphone, Users, LayoutDashboard,
  QrCode, Check, X, Search, Copy, CheckCheck, FileText, Sheet, Ticket,
  Phone, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { Card, Btn, Modal, FormField, Input, Toggle, Badge } from "../../components/ui";
import { eventsService, eventOpsService } from "../../services/events.service.js";
import QrScanner from "../../components/QrScanner.jsx";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";
const fmtInt = (n) => Number(n || 0).toLocaleString("fr-FR");

// ═══ DASHBOARD ═══════════════════════════════════════════════════════════════
export function DashboardTab({ event }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { eventsService.dashboard(event.id).then(setD).catch(console.error); }, [event.id]);
  if (!d) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;

  const r = d.reservations || {}, o = d.orders || {}, v = d.vip || {};
  const stat = (label, val, color = DARK) => (
    <div style={{ flex: 1, minWidth: 130, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color }}>{val}</div>
    </div>
  );
  const doExport = async (kind) => {
    setBusy(kind);
    try {
      const mod = await import("../../services/exports.js");
      const cols = ["Indicateur", "Valeur"];
      const rows = [
        ["Réservations", fmtInt(r.total)], ["Confirmées", fmtInt(r.confirmed)],
        ["Arrivées (check-in)", fmtInt(r.checked_in)], ["Couverts", fmtInt(r.covers)],
        ["Packs VIP vendus", fmtInt(v.vip_sold)], ["Revenu VIP", fmt(v.vip_revenue)],
        ["Commandes bouteilles", fmtInt(o.count)], ["Total commandes", fmt(o.total)], ["Encaissé", fmt(o.paid)],
        ...(d.top_bottles || []).map(b => [`Bouteille · ${b.name}`, `${b.qty}`]),
        ...(d.promoters || []).map(p => [`Promoteur · ${p.name} (${p.code})`, `${p.reservations} résa`]),
      ];
      const opt = { title: `Dashboard — ${event.name}`, subtitle: "Événement", columns: cols, rows, filename: `dashboard-${event.slug}` };
      kind === "pdf" ? await mod.exportPDF(opt) : await mod.exportXLSX({ ...opt, sheetName: "Dashboard" });
    } catch (e) { alert("Export impossible"); } finally { setBusy(null); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn icon={FileText} onClick={() => doExport("pdf")} disabled={busy}>{busy === "pdf" ? "…" : "PDF"}</Btn>
        <Btn icon={Sheet} onClick={() => doExport("xls")} disabled={busy}>{busy === "xls" ? "…" : "Excel"}</Btn>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat("Réservations", fmtInt(r.total))}
        {stat("Confirmées", fmtInt(r.confirmed), GREEN)}
        {stat("Arrivées", fmtInt(r.checked_in), P)}
        {stat("Couverts", fmtInt(r.covers))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat("Packs VIP vendus", fmtInt(v.vip_sold))}
        {stat("Revenu VIP", fmt(v.vip_revenue), GREEN)}
        {stat("Commandes", fmtInt(o.count))}
        {stat("Encaissé", fmt(o.paid), GREEN)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 12 }}>
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
export function StaffTab({ event }) {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: "", role: "all" });
  const load = () => eventsService.listStaff(event.id).then(d => setList(d?.staff || [])).catch(console.error);
  useEffect(() => { load(); }, [event.id]);
  const create = async () => { if (!f.name) return; try { await eventsService.createStaff(event.id, f); setModal(false); setF({ name: "", role: "all" }); load(); } catch { alert("Erreur"); } };
  const del = async (s) => { if (!window.confirm(`Retirer ${s.name} ?`)) return; try { await eventsService.deleteStaff(event.id, s.id); load(); } catch { alert("Erreur"); } };
  const staffUrl = `${window.location.origin}/staff`;
  const roleLabel = { all: "Tout", checkin: "Check-in", bar: "Bar" };

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
          <div style={{ display: "flex", gap: 8 }}>
            {[["all", "Tout"], ["checkin", "Check-in"], ["bar", "Bar"]].map(([k, label]) => (
              <button key={k} onClick={() => setF(p => ({ ...p, role: k }))}
                style={{ flex: 1, border: `1.5px solid ${f.role === k ? P : BORDER}`, borderRadius: 10, padding: "9px 0",
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
    </Card>
  );
}

// ═══ CHECK-IN ══════════════════════════════════════════════════════════════════
export function CheckinTab({ eventId, staffToken }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);   // réservation dépliée
  const [scanning, setScanning] = useState(false);
  const [confirm, setConfirm] = useState(null); // { resa, count, byScan }
  const [pinResult, setPinResult] = useState(null); // { pin, name, table } après check-in
  const [busy, setBusy] = useState(false);
  const load = () => eventOpsService.listCheckin(eventId, staffToken).then(setData).catch(console.error);
  useEffect(() => { load(); }, [eventId]);

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
      const info = { pin, name: confirm.resa.client_name, table: confirm.resa.table_label };
      setConfirm(null); await load();
      if (pin) setPinResult(info);
    } catch (e) { alert(e.response?.data?.message || "Erreur"); }
    finally { setBusy(false); }
  };
  const undo = async (r) => { try { await eventOpsService.checkin(r.id, true, staffToken, eventId); load(); } catch { alert("Erreur"); } };

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
                <button onClick={() => arrived ? undo(r) : setConfirm({ resa: r, count: r.party_size || 1, byScan: false })}
                  style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 8, padding: "8px 13px",
                    background: arrived ? "#e8e8e8" : GREEN, color: arrived ? DARK : "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {arrived ? <><X size={14} /> Annuler</> : <><Check size={14} /> Arrivé</>}
                </button>
              </div>
              {isOpen && (
                <div style={{ padding: "0 13px 12px", fontSize: 12.5, color: "#4a5a52", display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={13} color={MUTED} /> Réservé <strong>{r.party_size}</strong> · arrivés <strong>{arrived ? pax : "—"}</strong></div>
                  {r.table_label && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.table_kind === "vip" ? <Crown size={13} color={P} /> : <Armchair size={13} color={MUTED} />} {r.table_label}{r.table_price ? ` · ${fmt(r.table_price)}` : ""}</div>}
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

      {/* Confirmation d'arrivée : saisie du nombre réel de personnes */}
      {confirm && (
        <Modal open title="Confirmer l'arrivée" width={360} onClose={() => setConfirm(null)}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{confirm.resa.client_name || "Client"}</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
            <span style={{ fontFamily: "monospace" }}>{confirm.resa.ref}</span>
            {confirm.resa.table_label ? ` · ${confirm.resa.table_label}` : ""} · réservé {confirm.resa.party_size} pers.
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "1px" }}>
              Personnes réellement arrivées
            </div>
            {confirm.resa.table_capacity ? (
              <span style={{ fontSize: 11, color: MUTED }}>Salon : {confirm.resa.table_capacity} places max</span>
            ) : null}
          </div>
          {(() => {
            const cap = confirm.resa.table_capacity || 0;
            const atMax = cap > 0 && confirm.count >= cap;
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 8 }}>
                <button onClick={() => setConfirm(c => ({ ...c, count: Math.max(0, c.count - 1) }))} style={stepBtn}>−</button>
                <span style={{ fontSize: 30, fontWeight: 800, color: atMax ? "#DC2626" : DARK, minWidth: 44, textAlign: "center" }}>{confirm.count}</span>
                <button onClick={() => setConfirm(c => ({ ...c, count: cap > 0 ? Math.min(cap, c.count + 1) : c.count + 1 }))}
                  disabled={atMax} style={{ ...stepBtn, opacity: atMax ? 0.4 : 1, cursor: atMax ? "default" : "pointer" }}>+</button>
              </div>
            );
          })()}
          {confirm.resa.table_capacity && confirm.count >= confirm.resa.table_capacity && (
            <div style={{ fontSize: 11.5, color: "#DC2626", textAlign: "center", marginBottom: 10, display: "flex",
              alignItems: "center", justifyContent: "center", gap: 5 }}>
              <AlertTriangle size={13} /> Capacité maximale du salon atteinte
            </div>
          )}
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
            {busy ? "…" : "Confirmer l'arrivée"}
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
            <div style={{ fontSize: 12.5, color: "#4a5a52", lineHeight: 1.55, marginBottom: 18 }}>
              Remettez ce code au responsable du salon. Il en aura besoin pour <strong>passer les commandes</strong> via le QR de sa table.
            </div>
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
