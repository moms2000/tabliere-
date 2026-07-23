import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Receipt, RefreshCw, Printer, CheckCircle2 } from "lucide-react";
import { sessionsService } from "../../services/sessions.service.js";
import { printTicket, itemsToLines, fmtMoney } from "../../utils/printer.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P = "#E8A045"; const PL = "#FEF6EC"; const DARK = "#1E2E28"; const BG = "#F8F5EF";
const BORDER = "#E4DFD8"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

export default function RestRecus() {
  const { user } = useAuth();
  const restoName = user?.resto_name || "Restaurant";
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printNote, setPrintNote] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [splitMode, setSplitMode] = useState("total"); // total | equal | person
  const [splitN, setSplitN]       = useState(2);        // nombre de personnes
  const [assign, setAssign]       = useState({});       // itemId -> [personnes]
  const [names,  setNames]        = useState({});       // numéro -> prénom (optionnel)

  const openSplit = (detail) => {
    setAssign({});
    const initNames = {};
    (detail.convives || []).forEach(c => { if (c.name) initNames[c.num] = c.name; });
    setNames(initNames);
    setSplitN(Math.max(2, (detail.convives || []).length || 2));
    setSplitMode("total");
    setPrintNote(detail);
  };
  const personName = (p) => (names[p] && names[p].trim()) ? names[p].trim() : `Personne ${p}`;

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await sessionsService.list("open"); setSessions(d?.sessions || []); } catch (_) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const closeNote = async (id) => {
    if (!window.confirm("Clôturer cette note ? Elle disparaîtra des notes ouvertes.")) return;
    try { await sessionsService.close(id); setSessions(prev => prev.filter(s => s.session.id !== id)); } catch (_) {}
  };

  const dateNow = () => new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const printTotal = async (d) => {
    setPrinting(true);
    try {
      await printTicket({
        title: restoName, subtitle: "TablièreCI",
        tableLabel: d.session.table_label ? `Table ${d.session.table_label}` : "",
        dateText: dateNow(), lines: itemsToLines(d.items),
        totalLabel: "TOTAL", totalText: fmtMoney(d.total), footer: "Merci pour votre visite",
      });
    } catch (_) { alert("Impression impossible sur cet appareil."); }
    setPrinting(false);
  };
  const printConvive = async (d, c) => {
    const mine = (d.items || []).filter(i => i.status !== "cancelled" && i.convive_id === c.id);
    const sub = mine.reduce((s, i) => s + (Number(i.unit_price) || 0) * i.qty, 0);
    setPrinting(true);
    try {
      await printTicket({
        title: restoName, subtitle: "TablièreCI",
        tableLabel: `${d.session.table_label ? "Table " + d.session.table_label + " · " : ""}${c.name || "Personne " + c.num}`,
        dateText: dateNow(), lines: itemsToLines(mine),
        totalLabel: "À PAYER", totalText: fmtMoney(sub), footer: "Merci pour votre visite",
      });
    } catch (_) { alert("Impression impossible sur cet appareil."); }
    setPrinting(false);
  };
  const printAll = async (d) => {
    for (const c of (d.convives || [])) {
      const has = (d.items || []).some(i => i.status !== "cancelled" && i.convive_id === c.id);
      if (has) { await printConvive(d, c); await new Promise(r => setTimeout(r, 700)); }
    }
  };
  const liveItems = (d) => (d.items || []).filter(i => i.status !== "cancelled");

  // Parts égales : chacun paie le même montant (le dernier absorbe l'arrondi)
  const printEqual = async (d, n) => {
    const share = Math.floor(d.total / n);
    setPrinting(true);
    try {
      for (let i = 1; i <= n; i++) {
        const amount = i === n ? d.total - share * (n - 1) : share;
        await printTicket({
          title: restoName, subtitle: "TablièreCI",
          tableLabel: `${d.session.table_label ? "Table " + d.session.table_label + " · " : ""}${personName(i)} (${i}/${n})`,
          dateText: dateNow(), lines: itemsToLines(liveItems(d)),
          totalLabel: `A PAYER (PART ${i}/${n})`, totalText: fmtMoney(amount), footer: "Merci pour votre visite",
        });
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (_) { alert("Impression impossible sur cet appareil."); }
    setPrinting(false);
  };

  // Personnes attribuées à un plat (par défaut la personne 1). Un plat attribué à
  // plusieurs personnes est partagé à parts égales entre elles.
  const getAssignees = (map, it) => (map[it.id] && map[it.id].length ? map[it.id] : [1]);
  const toggleAssign = (itemId, p) => setAssign(a => {
    const cur = a[itemId] && a[itemId].length ? a[itemId] : [1];
    let next = cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p];
    if (next.length === 0) next = [p]; // toujours au moins une personne
    return { ...a, [itemId]: next.sort((x, y) => x - y) };
  });
  // Part d'une personne (plats partagés comptés au prorata)
  const personTotal = (d, p, map) =>
    liveItems(d).reduce((s, it) => {
      const as = getAssignees(map, it);
      return as.includes(p) ? s + (Number(it.unit_price) || 0) * it.qty / as.length : s;
    }, 0);

  // Chacun ses plats : un reçu par personne (plats partagés = portion au prorata)
  const printPerson = async (d, n, map) => {
    setPrinting(true);
    try {
      for (let p = 1; p <= n; p++) {
        const mine = liveItems(d).filter(it => getAssignees(map, it).includes(p));
        if (mine.length === 0) continue;
        let sub = 0;
        const lines = mine.map(it => {
          const as = getAssignees(map, it);
          const portion = Math.round((Number(it.unit_price) || 0) * it.qty / as.length);
          sub += portion;
          return {
            left: `${it.qty}x ${it.name}${it.options_label ? ` (${it.options_label})` : ""}${as.length > 1 ? ` [partage ÷${as.length}]` : ""}`,
            right: fmtMoney(portion),
          };
        });
        await printTicket({
          title: restoName, subtitle: "TablièreCI",
          tableLabel: `${d.session.table_label ? "Table " + d.session.table_label + " · " : ""}${personName(p)}`,
          dateText: dateNow(), lines,
          totalLabel: "A PAYER", totalText: fmtMoney(sub), footer: "Merci pour votre visite",
        });
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (_) { alert("Impression impossible sur cet appareil."); }
    setPrinting(false);
  };

  return (
    <div style={{ fontFamily: FONT, padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Receipt size={22} color={P} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: DARK, margin: 0 }}>Reçus par table</h1>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
            border: `0.5px solid ${BORDER}`, background: "white", fontSize: 12.5, cursor: "pointer", color: MUTED, fontFamily: FONT }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Actualiser
        </button>
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>
        Chaque table ouverte a sa note. Imprimez un reçu total ou un reçu par personne, puis clôturez.
      </p>

      {loading ? (
        <div style={{ color: MUTED, textAlign: "center", padding: 40 }}>Chargement…</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: MUTED, background: BG, borderRadius: 14 }}>
          <Receipt size={38} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Aucune table ouverte pour l'instant.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Les tables apparaissent dès qu'une commande y est passée.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
          {sessions.map(({ session, items, total, convives }) => {
            const live = (items || []).filter(i => i.status !== "cancelled");
            const rounds = new Set(live.map(i => i.round)).size;
            return (
              <div key={session.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {session.table_label ? `Table ${session.table_label}` : "Sans table"}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: P }}>{fmtMoney(total)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
                  {live.reduce((s, i) => s + i.qty, 0)} article(s) · {rounds} tournée(s){convives?.length ? ` · ${convives.length} convive(s)` : ""}
                </div>
                <div style={{ fontSize: 12.5, color: DARK, lineHeight: 1.6, marginBottom: 12, maxHeight: 150, overflowY: "auto" }}>
                  {live.map(i => (
                    <div key={i.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span><strong>{i.qty}×</strong> {i.name}{i.options_label ? <span style={{ color: "#C47D1A" }}> ({i.options_label})</span> : ""}</span>
                      <span style={{ color: MUTED }}>{fmtMoney((Number(i.unit_price) || 0) * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openSplit({ session, items, total, convives })}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0",
                      borderRadius: 9, border: "none", background: "#1e2e28", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                    <Printer size={14} /> Partager / Imprimer
                  </button>
                  <button onClick={() => closeNote(session.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 9,
                      border: `0.5px solid ${BORDER}`, background: BG, color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    <CheckCircle2 size={14} /> Clôturer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createPortal(
      <AnimatePresence>
        {printNote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPrintNote(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60 }} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: "min(380px, 94vw)", maxHeight: "84vh", overflowY: "auto", background: "white",
                borderRadius: 16, zIndex: 61, padding: 22, fontFamily: FONT, boxShadow: "0 10px 40px rgba(0,0,0,.2)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: DARK, marginBottom: 2 }}>
                Partager l'addition{printNote.session.table_label ? ` — Table ${printNote.session.table_label}` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>Total {fmtMoney(printNote.total)}</div>

              <div style={{ display: "flex", gap: 6, background: "#F0EDE6", borderRadius: 10, padding: 4, marginBottom: 16 }}>
                {[["total", "Un seul paie"], ["equal", "Parts égales"], ["person", "Chacun ses plats"]].map(([m, lab]) => (
                  <button key={m} type="button" onClick={() => setSplitMode(m)}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT,
                      fontSize: 12, fontWeight: splitMode === m ? 700 : 500, lineHeight: 1.2,
                      background: splitMode === m ? "white" : "transparent", color: splitMode === m ? DARK : MUTED,
                      boxShadow: splitMode === m ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
                    {lab}
                  </button>
                ))}
              </div>

              {splitMode === "total" && (
                <button onClick={() => printTotal(printNote)} disabled={printing}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 11, border: "none", background: P,
                    color: "#1a1000", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  Imprimer le reçu total ({fmtMoney(printNote.total)})
                </button>
              )}

              {splitMode === "equal" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13.5, color: DARK }}>Nombre de personnes</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => setSplitN(n => Math.max(2, n - 1))} style={stepBtn}>−</button>
                      <span style={{ fontSize: 17, fontWeight: 800, color: DARK, minWidth: 22, textAlign: "center" }}>{splitN}</span>
                      <button onClick={() => setSplitN(n => Math.min(20, n + 1))} style={stepBtn}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 12 }}>
                    {Array.from({ length: splitN }, (_, k) => k + 1).map(p => (
                      <input key={p} value={names[p] || ""} onChange={e => setNames(n => ({ ...n, [p]: e.target.value }))}
                        placeholder={`Personne ${p} (prénom)`}
                        style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px", fontSize: 12.5, outline: "none", fontFamily: FONT, background: BG, width: "100%", boxSizing: "border-box" }} />
                    ))}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, color: MUTED, marginBottom: 14 }}>
                    Chacun paie <strong style={{ color: P, fontSize: 15 }}>{fmtMoney(Math.floor(printNote.total / splitN))}</strong>
                  </div>
                  <button onClick={() => printEqual(printNote, splitN)} disabled={printing}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 11, border: "none", background: P,
                      color: "#1a1000", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                    Imprimer {splitN} reçus
                  </button>
                </>
              )}

              {splitMode === "person" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13.5, color: DARK }}>Nombre de personnes</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => setSplitN(n => Math.max(2, n - 1))} style={stepBtn}>−</button>
                      <span style={{ fontSize: 17, fontWeight: 800, color: DARK, minWidth: 22, textAlign: "center" }}>{splitN}</span>
                      <button onClick={() => setSplitN(n => Math.min(12, n + 1))} style={stepBtn}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 10 }}>
                    {Array.from({ length: splitN }, (_, k) => k + 1).map(p => (
                      <input key={p} value={names[p] || ""} onChange={e => setNames(n => ({ ...n, [p]: e.target.value }))}
                        placeholder={`Personne ${p} (prénom)`}
                        style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px", fontSize: 12.5, outline: "none", fontFamily: FONT, background: BG, width: "100%", boxSizing: "border-box" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Touche un numéro pour attribuer le plat. Plusieurs numéros = plat partagé à parts égales.</div>
                  <div style={{ maxHeight: 210, overflowY: "auto", marginBottom: 12 }}>
                    {liveItems(printNote).map(it => (
                      <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: `0.5px solid ${BG}` }}>
                        <div style={{ flex: 1, fontSize: 12.5, color: DARK }}>
                          {it.qty}× {it.name}{it.options_label ? <span style={{ color: "#C47D1A" }}> ({it.options_label})</span> : ""}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {Array.from({ length: splitN }, (_, k) => k + 1).map(p => {
                            const on = getAssignees(assign, it).includes(p);
                            return (
                              <button key={p} onClick={() => toggleAssign(it.id, p)}
                                style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${on ? P : BORDER}`, cursor: "pointer",
                                  background: on ? P : "white", color: on ? "#1a1000" : MUTED, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {Array.from({ length: splitN }, (_, k) => k + 1).map(p => (
                      <span key={p} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 20, background: PL, color: "#C47D1A" }}>
                        {personName(p)}: {fmtMoney(Math.round(personTotal(printNote, p, assign)))}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => printPerson(printNote, splitN, assign)} disabled={printing}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 11, border: "none", background: P,
                      color: "#1a1000", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                    Imprimer les reçus par personne
                  </button>
                </>
              )}

              {(printNote.convives || []).some(c => (printNote.items || []).some(i => i.status !== "cancelled" && i.convive_id === c.id)) && (
                <button onClick={() => printAll(printNote)} disabled={printing}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 11, border: `0.5px solid ${P}`, background: "white",
                    color: "#C47D1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginTop: 12 }}>
                  Imprimer par personne (répartition déjà faite)
                </button>
              )}

              <button onClick={() => setPrintNote(null)}
                style={{ width: "100%", padding: "11px 0", borderRadius: 11, border: `0.5px solid ${BORDER}`,
                  background: "white", color: MUTED, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginTop: 10 }}>
                Fermer
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}

const stepBtn = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid #E4DFD8", background: "white",
  color: "#1E2E28", fontSize: 18, fontWeight: 700, cursor: "pointer", lineHeight: 1, fontFamily: FONT,
};
