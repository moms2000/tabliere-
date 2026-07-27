// Impression de reçus — imprimante intégrée Sunmi si disponible, sinon navigateur.

export function getSunmiPrinter() {
  const cap = typeof window !== "undefined" ? window.Capacitor : null;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.SunmiPrinter) {
    return cap.Plugins.SunmiPrinter;
  }
  return null;
}

export function fmtMoney(n) {
  return `${Number(n || 0).toLocaleString("fr-FR")} F`;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const METHOD_LABELS = { especes:"Espèces", wave:"Wave", orange:"Orange Money", mtn:"MTN", moov:"Moov", carte:"Carte" };

/**
 * Imprime un ticket.
 * payload = { title, subtitle, tableLabel, ref, dateText, lines:[{left,right}],
 *             totalLabel, totalText, payments:[{method,amount}], change, footer }
 * Renvoie "sunmi" | "browser" | "blocked".
 */
export async function printTicket(payload) {
  const printer = getSunmiPrinter();
  if (printer) {
    await printer.printReceipt({
      restoName:  payload.title || "",
      subtitle:   payload.subtitle || "",
      ref:        payload.ref || "",
      tableLabel: payload.tableLabel || "",
      dateText:   payload.dateText || "",
      items:      payload.lines || [],
      totalText:  payload.totalText || "",
      payments:   payload.payments || [],
      footer:     payload.footer || "Powered by TablièreCI",
    });
    return "sunmi";
  }
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { alert("Autorise les fenêtres pour imprimer le reçu."); return "blocked"; }
  const rows = (payload.lines || [])
    .map(l => `<div class="row"><span class="l">${esc(l.left)}</span><span class="r">${esc(l.right)}</span></div>`).join("");
  const pays = (payload.payments || [])
    .map(p => `<div class="row"><span>${esc(METHOD_LABELS[p.method] || p.method || "Paiement")}</span><span class="r">${esc(fmtMoney(p.amount))}</span></div>`).join("");
  const change = payload.change ? `<div class="row"><span>Rendu</span><span class="r">${esc(fmtMoney(payload.change))}</span></div>` : "";
  w.document.write(`<html><head><title>Reçu</title><meta charset="utf-8"/><style>
    *{box-sizing:border-box}
    body{font-family:'Menlo','Consolas',monospace;font-size:12px;color:#000;padding:12px 10px;max-width:288px;margin:0 auto;line-height:1.45;word-break:break-word;overflow-wrap:anywhere}
    h2{text-align:center;font-size:16px;font-weight:800;margin:0 0 2px;word-break:break-word}
    .sub{text-align:center;color:#444;font-size:11px;margin-bottom:2px}
    .ref{text-align:center;font-weight:700;font-size:13px;margin-top:6px}
    .meta{text-align:center;font-size:11px;color:#333}
    hr{border:none;border-top:1px dashed #000;margin:8px 0}
    .row{display:flex;justify-content:space-between;gap:10px;margin:3px 0}
    .row .l{flex:1}.row .r{white-space:nowrap;font-variant-numeric:tabular-nums}
    .total{font-weight:800;font-size:15px}
    .center{text-align:center}
    .foot{text-align:center;font-size:10.5px;color:#333;margin-top:12px;line-height:1.6}
    .brand{font-weight:700}</style></head><body>
    <h2>${esc(payload.title || "")}</h2>
    ${payload.subtitle ? `<div class="sub">${esc(payload.subtitle)}</div>` : ""}
    ${payload.tableLabel ? `<div class="ref">${esc(payload.tableLabel)}</div>` : ""}
    ${payload.ref ? `<div class="meta">Réf. ${esc(payload.ref)}</div>` : ""}
    ${payload.dateText ? `<div class="meta">${esc(payload.dateText)}</div>` : ""}
    <hr/>
    ${rows}
    <hr/>
    <div class="row total"><span>${esc(payload.totalLabel || "TOTAL")}</span><span class="r">${esc(payload.totalText || "")}</span></div>
    ${pays ? `<hr/>${pays}${change}` : ""}
    <div class="foot">
      ${payload.footer ? `${esc(payload.footer)}<br/>` : "Merci de votre visite<br/>"}
      <span class="brand">Powered by TablièreCI</span> · tabliereci.net
    </div>
    </body></html>`);
  w.document.close();
  w.print();
  return "browser";
}

// Construit les lignes d'un reçu à partir des articles d'une note.
export function itemsToLines(items) {
  return (items || [])
    .filter(i => i.status !== "cancelled")
    .map(i => ({
      left:  `${i.qty}x ${i.name}${i.options_label ? ` (${i.options_label})` : ""}`,
      right: fmtMoney((Number(i.unit_price) || 0) * i.qty),
    }));
}
