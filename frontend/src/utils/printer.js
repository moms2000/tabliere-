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

/**
 * Imprime un ticket.
 * payload = { title, subtitle, tableLabel, dateText, lines:[{left,right}], totalLabel, totalText, footer }
 * Renvoie "sunmi" | "browser" | "blocked".
 */
export async function printTicket(payload) {
  const printer = getSunmiPrinter();
  if (printer) {
    await printer.printReceipt({
      restoName:  payload.title || "",
      tableLabel: payload.tableLabel || "",
      dateText:   payload.dateText || "",
      items:      payload.lines || [],
      totalText:  payload.totalText || "",
      footer:     payload.footer || "",
    });
    return "sunmi";
  }
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) { alert("Autorise les fenêtres pour imprimer le reçu."); return "blocked"; }
  const rows = (payload.lines || [])
    .map(l => `<div class="row"><span>${l.left || ""}</span><span>${l.right || ""}</span></div>`).join("");
  w.document.write(`<html><head><title>Reçu</title><meta charset="utf-8"/><style>
    body{font-family:monospace;font-size:13px;padding:16px;max-width:300px;margin:0 auto}
    h2{text-align:center;font-size:16px;margin:0 0 2px}
    .sub{text-align:center;color:#666;font-size:11px}
    hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0}
    .total{font-weight:bold;font-size:15px}.center{text-align:center}</style></head><body>
    <h2>${payload.title || ""}</h2>${payload.subtitle ? `<div class="sub">${payload.subtitle}</div>` : ""}
    <hr/>${payload.tableLabel ? `<div class="center"><strong>${payload.tableLabel}</strong></div>` : ""}
    ${payload.dateText ? `<div class="center" style="font-size:11px">${payload.dateText}</div>` : ""}<hr/>
    ${rows}<hr/>
    <div class="row total"><span>${payload.totalLabel || "TOTAL"}</span><span>${payload.totalText || ""}</span></div><hr/>
    ${payload.footer ? `<div class="center" style="font-size:11px;margin-top:10px">${payload.footer}</div>` : ""}
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
