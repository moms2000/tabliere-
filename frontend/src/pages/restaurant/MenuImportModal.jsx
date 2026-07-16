import { useState } from "react";
import { Upload, FileSpreadsheet, FileText, Download, X, Check, AlertTriangle, Trash2 } from "lucide-react";
import { menuService } from "../../services/menu.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";

// En-têtes acceptés (insensibles à la casse/accents) → colonne canonique
const stripAccents = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const COL = {
  category:    ["categorie", "category", "cat", "rubrique"],
  name:        ["nom", "name", "plat", "produit", "article", "designation", "libelle"],
  price:       ["prix", "price", "tarif", "montant"],
  description: ["description", "desc", "details", "detail"],
};
const colOf = (header) => {
  const h = stripAccents(header);
  for (const [canon, aliases] of Object.entries(COL)) if (aliases.includes(h)) return canon;
  return null;
};
const toPrice = (v) => Math.max(0, Math.round(Number(String(v ?? "").replace(/[^\d]/g, "")) || 0));

export default function MenuImportModal({ onClose, onImported }) {
  const [tab, setTab] = useState("excel"); // "excel" | "pdf"
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // [{ name, items:[{name,price,description}] }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const totals = preview
    ? { cats: preview.length, items: preview.reduce((s, c) => s + c.items.length, 0) }
    : { cats: 0, items: 0 };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Catégorie", "Nom", "Prix", "Description"],
      ["Entrées", "Salade César", 3500, "Salade, poulet grillé, parmesan"],
      ["Plats", "Attiéké poisson", 5000, "Poisson braisé, attiéké, alloco"],
      ["Boissons", "Coca-Cola 33cl", 1000, ""],
    ]);
    ws["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Menu");
    XLSX.writeFile(wb, "modele-menu-tabliereci.xlsx");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    setErr(""); setPreview(null); setFileName(file.name); setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) throw new Error("empty");

      // Mapper les en-têtes du fichier vers nos colonnes
      const headerMap = {};
      Object.keys(rows[0]).forEach(h => { const c = colOf(h); if (c) headerMap[h] = c; });
      const hasName = Object.values(headerMap).includes("name");
      if (!hasName) throw new Error("headers");

      // Regrouper par catégorie (ordre d'apparition préservé, insensible à la casse)
      const order = [];
      const map = {};
      for (const row of rows) {
        const rec = {};
        for (const [h, canon] of Object.entries(headerMap)) rec[canon] = row[h];
        const name = String(rec.name || "").trim();
        if (!name) continue;
        const cat = String(rec.category || "Autres").trim() || "Autres";
        const key = stripAccents(cat);
        if (!map[key]) { map[key] = { name: cat, items: [] }; order.push(key); }
        map[key].items.push({ name: name.slice(0, 120), price: toPrice(rec.price), description: String(rec.description || "").trim().slice(0, 500) });
      }
      const result = order.map(k => map[k]).filter(c => c.items.length);
      if (!result.length) throw new Error("empty");
      setPreview(result);
    } catch (e2) {
      const m = e2.message;
      setErr(m === "headers"
        ? "Colonnes introuvables. Utilisez le modèle (colonnes : Catégorie, Nom, Prix, Description)."
        : m === "empty" ? "Le fichier ne contient aucun plat lisible."
        : "Fichier illisible. Utilisez un .xlsx, .xls ou .csv (voir le modèle).");
      setFileName("");
    } finally { setBusy(false); }
  };

  const removeItem = (ci, ii) => setPreview(prev => {
    const next = prev.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c).filter(c => c.items.length);
    return next.length ? next : null;
  });

  const doImport = async () => {
    if (!preview?.length || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await menuService.importMenu(preview);
      onImported?.(r);
      onClose();
    } catch (e2) {
      setErr(e2.response?.data?.message || "Échec de l'import (connexion lente ?). Réessayez — rien n'a été enregistré.");
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 560, maxHeight: "88vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 20px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
          <Upload size={19} color={P} />
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: DARK }}>Importer le menu</div>
          <button onClick={onClose} style={{ border: "none", background: BG, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={MUTED} /></button>
        </div>

        {/* Choix du format */}
        <div style={{ display: "flex", gap: 8, padding: "12px 20px 0" }}>
          {[["excel", "Excel / CSV", FileSpreadsheet], ["pdf", "PDF", FileText]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => { setTab(k); setErr(""); }}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${tab === k ? P : BORDER}`,
                background: tab === k ? "#FEF6EC" : "white", color: tab === k ? "#8a5a10" : MUTED, borderRadius: 10, padding: "9px 0",
                cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {err && (
            <div style={{ display: "flex", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{err}</span>
            </div>
          )}

          {tab === "pdf" ? (
            <div style={{ textAlign: "center", padding: "24px 10px", color: MUTED }}>
              <FileText size={34} color={BORDER} />
              <div style={{ fontSize: 14, fontWeight: 600, color: DARK, marginTop: 12 }}>Import PDF par IA — bientôt</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8, maxWidth: 360, margin: "8px auto 0" }}>
                L'extraction automatique d'un menu PDF nécessite l'activation de l'IA (clé à configurer). En attendant, l'import <strong>Excel / CSV</strong> est 100% fiable et immédiat.
              </div>
            </div>
          ) : !preview ? (
            <>
              <div style={{ fontSize: 13, color: "#4a5a52", lineHeight: 1.6, marginBottom: 14 }}>
                Téléchargez le modèle, remplissez-le (une ligne = un plat), puis réimportez-le. Colonnes : <strong>Catégorie, Nom, Prix, Description</strong>.
              </div>
              <button onClick={downloadTemplate}
                style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "white", color: DARK, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
                <Download size={16} color={P} /> Télécharger le modèle Excel
              </button>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${BORDER}`, borderRadius: 12, padding: "28px 16px", cursor: "pointer", background: BG }}>
                <Upload size={24} color={P} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{busy ? "Lecture du fichier…" : "Choisir un fichier (.xlsx, .xls, .csv)"}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{fileName || "Aucun fichier sélectionné"}</div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={busy} style={{ display: "none" }} />
              </label>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0F6F2", border: `0.5px solid ${GREEN}`, color: GREEN, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                <Check size={16} /> {totals.items} plat{totals.items > 1 ? "s" : ""} dans {totals.cats} catégorie{totals.cats > 1 ? "s" : ""}. Vérifiez avant d'importer.
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {preview.map((c, ci) => (
                  <div key={ci} style={{ border: `0.5px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: BG, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: P, textTransform: "uppercase", letterSpacing: ".5px" }}>{c.name} · {c.items.length}</div>
                    <div>
                      {c.items.map((it, ii) => (
                        <div key={ii} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: `0.5px solid ${BG}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{it.name}</div>
                            {it.description && <div style={{ fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.description}</div>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: it.price ? P : "#DC2626" }}>{it.price ? fmt(it.price) : "prix ?"}</div>
                          <button onClick={() => removeItem(ci, ii)} title="Retirer" style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED, padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {tab === "excel" && preview && (
          <div style={{ display: "flex", gap: 8, padding: "12px 20px calc(env(safe-area-inset-bottom,0px) + 14px)", borderTop: `0.5px solid ${BORDER}` }}>
            <button onClick={() => { setPreview(null); setFileName(""); }} style={{ border: `1px solid ${BORDER}`, background: "white", color: MUTED, borderRadius: 10, padding: "11px 16px", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>Changer de fichier</button>
            <button onClick={doImport} disabled={busy}
              style={{ flex: 1, border: "none", borderRadius: 10, padding: "11px 0", background: P, color: "#1A1000", cursor: busy ? "default" : "pointer", fontFamily: FONT, fontSize: 14.5, fontWeight: 700 }}>
              {busy ? "Import en cours…" : `Importer ${totals.items} plat${totals.items > 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
