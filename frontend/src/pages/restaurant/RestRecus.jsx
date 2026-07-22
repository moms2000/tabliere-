import { useState, useEffect, useCallback } from "react";
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
        tableLabel: `${d.session.table_label ? "Table " + d.session.table_label + " · " : ""}${c.name || "Convive " + c.num}`,
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
                  <button onClick={() => setPrintNote({ session, items, total, convives })}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0",
                      borderRadius: 9, border: "none", background: "#1e2e28", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                    <Printer size={14} /> Imprimer
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

      <AnimatePresence>
        {printNote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPrintNote(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60 }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: "min(380px, 94vw)", maxHeight: "84vh", overflowY: "auto", background: "white",
                borderRadius: 16, zIndex: 61, padding: 22, fontFamily: FONT, boxShadow: "0 10px 40px rgba(0,0,0,.2)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: DARK, marginBottom: 2 }}>
                Imprimer {printNote.session.table_label ? `— Table ${printNote.session.table_label}` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Reçu total ou par convive</div>
              <button onClick={() => printTotal(printNote)} disabled={printing}
                style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", background: P,
                  color: "#1a1000", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 16 }}>
                Reçu total ({fmtMoney(printNote.total)})
              </button>
              {(printNote.convives || []).some(c => (printNote.items || []).some(i => i.status !== "cancelled" && i.convive_id === c.id)) && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Par convive</div>
                  {(printNote.convives || []).map(c => {
                    const mine = (printNote.items || []).filter(i => i.status !== "cancelled" && i.convive_id === c.id);
                    if (mine.length === 0) return null;
                    const sub = mine.reduce((s, i) => s + (Number(i.unit_price) || 0) * i.qty, 0);
                    return (
                      <button key={c.id} onClick={() => printConvive(printNote, c)} disabled={printing}
                        style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "11px 13px",
                          borderRadius: 11, border: `0.5px solid ${BORDER}`, background: "white", color: DARK,
                          fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
                        <span>{c.name || `Convive ${c.num}`}</span><span style={{ color: P }}>{fmtMoney(sub)}</span>
                      </button>
                    );
                  })}
                  <button onClick={() => printAll(printNote)} disabled={printing}
                    style={{ width: "100%", padding: "11px 0", borderRadius: 11, border: `0.5px solid ${P}`, background: PL,
                      color: "#C47D1A", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
                    Tout imprimer (un reçu par convive)
                  </button>
                </>
              )}
              <button onClick={() => setPrintNote(null)}
                style={{ width: "100%", padding: "11px 0", borderRadius: 11, border: `0.5px solid ${BORDER}`,
                  background: "white", color: MUTED, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginTop: 4 }}>
                Fermer
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
