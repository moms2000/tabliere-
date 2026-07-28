import { useState } from "react";
import { Upload, FileSpreadsheet, Download, X, Check, AlertTriangle, Trash2, QrCode, Clock } from "lucide-react";
import { eventReservationsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const stripAccents = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const COL = {
  name:  ["nom", "name", "client", "prenom", "prenoms", "nom et prenom", "nom complet", "nom prenom"],
  phone: ["telephone", "tel", "phone", "whatsapp", "contact", "mobile", "numero", "portable"],
  email: ["email", "mail", "courriel", "e-mail", "adresse email"],
  party: ["personnes", "personne", "pers", "nombre", "nb", "couverts", "pax", "invites", "taille", "convives"],
  table: ["table", "tables", "emplacement", "place", "no table", "numero table"],
  paid:  ["acompte", "paye", "paid", "regle", "avance", "statut", "status", "paiement", "versement", "verse"],
  note:  ["demande", "remarque", "note", "commentaire", "special", "observation"],
};
const colOf = (header) => {
  const h = stripAccents(header);
  const hit = (a) => h === a || (h.length > a.length && h.startsWith(a) && /[^a-z0-9]/.test(h.charAt(a.length)));
  for (const [canon, aliases] of Object.entries(COL)) if (aliases.some(hit)) return canon;
  return null;
};
// « Payé » : montant > 0, ou mot-clé positif. « Non / en attente / 0 » = pas payé.
const isPaid = (v) => {
  const raw = String(v ?? "").trim();
  if (!raw) return false;
  const s = stripAccents(raw);
  if (/(^|[^a-z])(non|no|pas|attente|impaye|reste|aucun|false)/.test(s)) return false;
  const num = Number(raw.replace(/[^\d]/g, ""));
  if (/^\d/.test(s) && num > 0) return true;
  return /paye|oui|yes|recu|confirme|regle|\bok\b|paid|true|✓/.test(s) || s === "x";
};
const isValid = (r) => r.guest_name && (r.guest_phone || r.guest_email);

export default function EventResaImportModal({ eventId, onClose, onDone }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);   // lignes analysées (éditables)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  const valid = (rows || []).filter(isValid);
  const paidCount = valid.filter((r) => r.paid).length;

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nom", "Téléphone", "Email", "Personnes", "Table", "Acompte payé", "Demande"],
      ["Mohamed Coulibaly", "+2250700000000", "client@mail.com", 4, "T10", "Oui", "Anniversaire"],
      ["Awa Traoré", "0501020304", "", 2, "T3", "Non", ""],
      ["Jean Kouassi", "0700000001", "jean@mail.com", 6, "VIP1", "Oui", "Près de la scène"],
    ]);
    ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Réservations");
    XLSX.writeFile(wb, "modele-reservations-tabliereci.xlsx");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(""); setRows(null); setSummary(null); setFileName(file.name); setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) throw new Error("empty");

      const map = {};
      Object.keys(raw[0]).forEach((h) => { const c = colOf(h); if (c) map[h] = c; });
      if (!Object.values(map).includes("name")) throw new Error("headers");

      const parsed = raw.map((row) => {
        const rec = {};
        for (const [h, canon] of Object.entries(map)) rec[canon] = row[h];
        return {
          guest_name: String(rec.name || "").trim().slice(0, 120),
          guest_phone: String(rec.phone || "").trim().slice(0, 30),
          guest_email: String(rec.email || "").trim().slice(0, 200),
          party_size: Math.max(1, parseInt(String(rec.party ?? "").replace(/\D/g, ""), 10) || 1),
          table_label: String(rec.table || "").trim().slice(0, 30),
          paid: map && Object.values(map).includes("paid") ? isPaid(rec.paid) : false,
          special_request: String(rec.note || "").trim().slice(0, 300),
        };
      }).filter((r) => r.guest_name || r.guest_phone || r.guest_email);
      if (!parsed.length) throw new Error("empty");
      setRows(parsed);
    } catch (e2) {
      setErr(e2.message === "headers"
        ? "Colonne « Nom » introuvable. Utilisez le modèle (colonnes : Nom, Téléphone, Email, Personnes, Table, Acompte payé)."
        : e2.message === "empty" ? "Le fichier ne contient aucune réservation lisible."
        : "Fichier illisible. Utilisez un .xlsx, .xls ou .csv (voir le modèle).");
      setFileName("");
    } finally { setBusy(false); }
  };

  const togglePaid = (i) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, paid: !r.paid } : r));
  const removeRow = (i) => setRows((prev) => prev.filter((_, j) => j !== i));

  const doImport = async () => {
    if (!valid.length || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await eventReservationsService.importList({ event_id: eventId, rows: valid });
      setSummary(r);
    } catch (e2) {
      setErr(e2.response?.data?.message || "L'import n'a pas abouti. Réessayez, rien n'a été enregistré.");
    } finally { setBusy(false); }
  };

  const finish = () => { onDone?.(summary); onClose(); };

  return (
    <div onClick={summary ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 620, maxHeight: "90vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 20px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
          <Upload size={19} color={P} />
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: DARK }}>Importer des réservations</div>
          <button onClick={onClose} style={{ border: "none", background: BG, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={MUTED} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {err && (
            <div style={{ display: "flex", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{err}</span>
            </div>
          )}

          {/* ── Résumé après import ─────────────────────────────────────── */}
          {summary ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0F6F2", border: `0.5px solid ${GREEN}`, color: GREEN, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 14, fontWeight: 700 }}>
                <Check size={18} /> {summary.created} réservation{summary.created > 1 ? "s" : ""} importée{summary.created > 1 ? "s" : ""}
              </div>
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK }}>
                  <QrCode size={15} color={GREEN} /> <strong>{summary.confirmed}</strong> confirmée{summary.confirmed > 1 ? "s" : ""} — QR disponible (acompte reçu)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK }}>
                  <Clock size={15} color={P} /> <strong>{summary.pending}</strong> en attente d'acompte
                </div>
              </div>
              {(summary.warnings?.length > 0 || summary.skipped?.length > 0) && (
                <div style={{ fontSize: 12, color: "#7a5a1a", background: "#FEF6EC", border: "0.5px solid #F0C98A", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6 }}>
                  {summary.skipped?.length > 0 && <div style={{ marginBottom: summary.warnings?.length ? 6 : 0 }}><strong>{summary.skipped.length} ligne(s) ignorée(s)</strong> : {summary.skipped.slice(0, 5).map((s) => `L${s.line} ${s.reason}`).join(" · ")}{summary.skipped.length > 5 ? "…" : ""}</div>}
                  {summary.warnings?.length > 0 && <div>{summary.warnings.slice(0, 5).map((w) => `L${w.line} ${w.reason}`).join(" · ")}{summary.warnings.length > 5 ? "…" : ""}</div>}
                </div>
              )}
              <div style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
                Aucun message n'a été envoyé aux clients. Pour transmettre un QR, utilisez « Renvoyer le QR » sur une réservation confirmée.
              </div>
            </div>
          ) : !rows ? (
            /* ── Étape 1 : choix du fichier ──────────────────────────────── */
            <>
              <div style={{ fontSize: 13, color: "#4a5a52", lineHeight: 1.6, marginBottom: 14 }}>
                Importez votre liste existante (une ligne = une réservation). Colonnes reconnues : <strong>Nom, Téléphone, Email, Personnes, Table, Acompte payé, Demande</strong>. Les lignes marquées payées seront confirmées (QR généré) ; les autres resteront en attente d'acompte.
              </div>
              <button onClick={downloadTemplate}
                style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "white", color: DARK, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
                <Download size={16} color={P} /> Télécharger le modèle Excel
              </button>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${BORDER}`, borderRadius: 12, padding: "28px 16px", cursor: "pointer", background: BG }}>
                <FileSpreadsheet size={24} color={P} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{busy ? "Lecture du fichier…" : "Choisir un fichier (.xlsx, .xls, .csv)"}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{fileName || "Aucun fichier sélectionné"}</div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={busy} style={{ display: "none" }} />
              </label>
            </>
          ) : (
            /* ── Étape 2 : aperçu éditable ───────────────────────────────── */
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0F6F2", border: `0.5px solid ${GREEN}`, color: GREEN, borderRadius: 10, padding: "10px 12px", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                <Check size={16} /> {valid.length} réservation{valid.length > 1 ? "s" : ""} valides · {paidCount} marquée{paidCount > 1 ? "s" : ""} payée{paidCount > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>Cochez « Payé » pour générer le QR immédiatement. Décochez pour laisser en attente d'acompte.</div>
              <div style={{ display: "grid", gap: 6 }}>
                {rows.map((r, i) => {
                  const ok = isValid(r);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: `0.5px solid ${ok ? BORDER : "#FECACA"}`, background: ok ? "white" : "#FEF2F2", borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {r.guest_name || <span style={{ color: "#B91C1C" }}>Nom manquant</span>}
                          <span style={{ fontSize: 11, color: MUTED }}>· {r.party_size} pers.</span>
                          {r.table_label && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a5a10", background: "#FEF6EC", borderRadius: 6, padding: "1px 7px" }}>{r.table_label}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: ok ? MUTED : "#B91C1C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ok ? [r.guest_phone, r.guest_email].filter(Boolean).join(" · ") : "Téléphone ou e-mail requis"}
                        </div>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: r.paid ? GREEN : MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={!!r.paid} onChange={() => togglePaid(i)} disabled={!ok} />
                        Payé
                      </label>
                      <button onClick={() => removeRow(i)} title="Retirer" style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED, padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Barre d'action ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, padding: "12px 20px calc(env(safe-area-inset-bottom,0px) + 14px)", borderTop: `0.5px solid ${BORDER}` }}>
          {summary ? (
            <button onClick={finish} style={{ flex: 1, border: "none", borderRadius: 10, padding: "11px 0", background: P, color: "#1A1000", cursor: "pointer", fontFamily: FONT, fontSize: 14.5, fontWeight: 700 }}>Terminé</button>
          ) : rows ? (
            <>
              <button onClick={() => { setRows(null); setFileName(""); }} style={{ border: `1px solid ${BORDER}`, background: "white", color: MUTED, borderRadius: 10, padding: "11px 16px", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>Changer</button>
              <button onClick={doImport} disabled={busy || !valid.length}
                style={{ flex: 1, border: "none", borderRadius: 10, padding: "11px 0", background: valid.length ? P : BORDER, color: "#1A1000", cursor: busy || !valid.length ? "default" : "pointer", fontFamily: FONT, fontSize: 14.5, fontWeight: 700 }}>
                {busy ? "Import en cours…" : `Importer ${valid.length} réservation${valid.length > 1 ? "s" : ""}`}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
