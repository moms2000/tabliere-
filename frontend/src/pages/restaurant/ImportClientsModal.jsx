import { useState } from "react";
import { UploadCloud, X, Check, AlertTriangle, FileText } from "lucide-react";
import { Modal, Btn } from "../../components/ui";
import { reservationsService } from "../../services/reservations.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

// ── Parseur CSV robuste (guillemets, séparateur , ou ;) ──────────────────────
function parseCSV(text) {
  const head = text.slice(0, (text.indexOf("\n") + 1) || text.length);
  const delim = head.split(";").length > head.split(",").length ? ";" : ",";
  const rows = []; let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => (c || "").trim() !== ""));
}

// Reconnaît une colonne d'après son en-tête
const guess = (headers, keys) => {
  const idx = headers.findIndex(h => keys.some(k => (h || "").toLowerCase().replace(/[^a-z]/g, "").includes(k)));
  return idx >= 0 ? String(idx) : "";
};

// Recompose un téléphone complet à partir du numéro + indicatif pays
function buildPhone(phone, cc) {
  const p = (phone || "").trim();
  if (!p) return "";
  if (p.startsWith("+")) return p;
  const c = (cc || "").replace(/\D/g, "");
  if (c && !p.replace(/\D/g, "").startsWith(c)) return `+${c} ${p}`;
  return p;
}

export default function ImportClientsModal({ open, onClose, onDone }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);        // lignes (arrays)
  const [map, setMap] = useState({ name: "", phone: "", cc: "", email: "" });
  const [noteCols, setNoteCols] = useState({ visits: "", amount: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const reset = () => { setFileName(""); setHeaders([]); setData([]); setMap({ name: "", phone: "", cc: "", email: "" }); setNoteCols({ visits: "", amount: "" }); setConsent(false); setResult(null); setErr(""); };
  const close = () => { reset(); onClose(); };

  const onFile = (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setErr(""); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(String(ev.target.result || ""));
        if (rows.length < 2) { setErr("Fichier vide ou sans données."); return; }
        const hs = rows[0].map(h => (h || "").trim());
        setHeaders(hs); setData(rows.slice(1)); setFileName(file.name);
        setMap({
          name:  guess(hs, ["name", "nom", "client", "fullname"]),
          phone: guess(hs, ["phonenumber", "phone", "tel", "mobile", "numero"]),
          cc:    guess(hs, ["countrycode", "indicatif"]),
          email: guess(hs, ["email", "mail", "courriel"]),
        });
        setNoteCols({ visits: guess(hs, ["nbvisits", "visits", "visites"]), amount: guess(hs, ["totalamountpaid", "totalpaid", "montant"]) });
      } catch { setErr("Impossible de lire ce fichier CSV."); }
    };
    reader.onerror = () => setErr("Erreur de lecture du fichier.");
    reader.readAsText(file, "UTF-8");
  };

  const cell = (row, idx) => (idx === "" || idx == null) ? "" : (row[Number(idx)] || "").trim();
  const buildContacts = () => data.map(row => {
    const phone = buildPhone(cell(row, map.phone), cell(row, map.cc));
    const bits = [];
    const v = cell(row, noteCols.visits); if (v) bits.push(`${v} visite(s)`);
    const a = cell(row, noteCols.amount); if (a) bits.push(`${a} F`);
    return {
      name: cell(row, map.name) || null,
      phone: phone || null,
      email: cell(row, map.email) || null,
      note: bits.length ? `Import : ${bits.join(" · ")}` : null,
    };
  }).filter(c => c.phone || c.email);

  const preview = data.length ? buildContacts().slice(0, 5) : [];
  const usable = preview.length && (map.phone !== "" || map.email !== "");

  const doImport = async () => {
    if (!consent) { setErr("Veuillez cocher la case de consentement."); return; }
    const contacts = buildContacts();
    if (!contacts.length) { setErr("Aucun contact exploitable (téléphone ou email requis)."); return; }
    setBusy(true); setErr("");
    try {
      const r = await reservationsService.importClients({ contacts, consent: true });
      setResult(r);
      onDone?.();
    } catch (e) { setErr(e.response?.data?.message || "Import impossible. Réessayez."); }
    finally { setBusy(false); }
  };

  const sel = (value, onChange) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px",
        fontFamily: FONT, fontSize: 12.5, background: "white", color: value ? DARK : MUTED }}>
      <option value="">— Ignorer —</option>
      {headers.map((h, i) => <option key={i} value={String(i)}>{h || `Colonne ${i + 1}`}</option>)}
    </select>
  );

  return (
    <Modal open={open} title="Importer une base clients (CSV)" width={520} onClose={close}>
      {result ? (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Check size={30} color={GREEN} /></div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: DARK, marginBottom: 8 }}>Import terminé</div>
          <div style={{ fontSize: 13, color: "#4a5a52", lineHeight: 1.7 }}>
            <div><strong style={{ color: GREEN }}>{result.imported}</strong> nouveaux contacts</div>
            <div><strong>{result.updated}</strong> mis à jour</div>
            <div style={{ color: MUTED }}>{result.skipped} ignoré(s) (doublons ou vides)</div>
          </div>
          <Btn variant="primary" onClick={close} style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>Terminé</Btn>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {!headers.length ? (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              border: `1.5px dashed ${BORDER}`, borderRadius: 12, padding: "26px 16px", cursor: "pointer", background: BG, textAlign: "center" }}>
              <UploadCloud size={26} color={P} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>Choisir un fichier CSV</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>Colonnes attendues : nom, téléphone, email (les en-têtes sont détectés automatiquement)</div>
              <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
            </label>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: DARK }}>
                <FileText size={14} color={MUTED} /> {fileName} · <strong>{data.length}</strong> ligne(s)
                <button onClick={reset} style={{ marginLeft: "auto", border: "none", background: "transparent", color: MUTED, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}><X size={12} /> Changer</button>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Correspondance des colonnes</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><div style={lbl}>Nom</div>{sel(map.name, v => setMap(m => ({ ...m, name: v })))}</div>
                <div><div style={lbl}>Email</div>{sel(map.email, v => setMap(m => ({ ...m, email: v })))}</div>
                <div><div style={lbl}>Téléphone</div>{sel(map.phone, v => setMap(m => ({ ...m, phone: v })))}</div>
                <div><div style={lbl}>Indicatif pays (optionnel)</div>{sel(map.cc, v => setMap(m => ({ ...m, cc: v })))}</div>
              </div>

              {usable && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Aperçu (5 premières)</div>
                  <div style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                    {preview.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "7px 10px", fontSize: 12, borderTop: i ? `0.5px solid ${BG}` : "none" }}>
                        <span style={{ flex: 1, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "—"}</span>
                        <span style={{ flex: 1, color: "#4a5a52", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.phone || "—"}</span>
                        <span style={{ flex: 1, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#4a5a52", cursor: "pointer", lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                Je certifie disposer du consentement de ces clients pour enregistrer leurs coordonnées dans TablièreCI.
              </label>

              {err && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#DC2626" }}><AlertTriangle size={14} /> {err}</div>}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn onClick={close}>Annuler</Btn>
                <Btn variant="primary" icon={UploadCloud} onClick={doImport} disabled={busy || !usable || !consent}>
                  {busy ? "Import…" : `Importer ${buildContacts().length} contact(s)`}
                </Btn>
              </div>
            </>
          )}
          {err && !headers.length && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#DC2626" }}><AlertTriangle size={14} /> {err}</div>}
        </div>
      )}
    </Modal>
  );
}

const lbl = { fontSize: 11.5, color: MUTED, marginBottom: 4 };
