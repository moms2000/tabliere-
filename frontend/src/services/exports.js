/**
 * Exports PDF / Excel brandés TablièreCI.
 * Les libs (jspdf, xlsx) sont importées dynamiquement → aucun impact sur le bundle initial.
 */

const AMBER = [232, 160, 69];
const DARK  = [30, 46, 40];

// Anti-injection de formule (CSV/XLSX) : une cellule texte commençant par
// = + - @ (ou tab/CR) est interprétée comme une formule par Excel/LibreOffice.
// On la neutralise avec une apostrophe de tête. Les données importées (noms de
// clients, notes) pouvant contenir des charges malveillantes, on assainit partout.
function sanitizeCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function drawLogo(doc, x, y, s = 26) {
  // Carré arrondi orange + marques blanches (rappel du logo)
  doc.setFillColor(...AMBER);
  doc.roundedRect(x, y, s, s, s * 0.22, s * 0.22, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(x + s * 0.22, y + s * 0.30, s * 0.56, s * 0.07, "F");   // barre horizontale (assiette)
  doc.rect(x + s * 0.42, y + s * 0.36, s * 0.15, s * 0.34, "F");   // barre verticale (couvert)
}

const todayStr = () =>
  new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Génère un PDF brandé avec un tableau.
 * @param {{title:string, subtitle?:string, columns:string[], rows:(string|number)[][], filename:string, summary?:{label:string,value:string|number}[]}} o
 */
// Le PDF n'est pas fait pour des milliers de lignes (jspdf sature la mémoire du
// navigateur). On plafonne ; au-delà, Excel/CSV prennent le relais.
const MAX_PDF_ROWS = 1500;

export async function exportPDF({ title, subtitle, columns, rows, filename, summary = [] }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  const totalRows = rows.length;
  const truncated = totalRows > MAX_PDF_ROWS;
  if (truncated) rows = rows.slice(0, MAX_PDF_ROWS);

  // En-tête brandé
  drawLogo(doc, 40, 34, 28);
  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("TablièreCI", 78, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(150, 150, 150);
  doc.text(subtitle || "Réservez votre table", 78, 63);

  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(title, W - 40, 46, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${todayStr()}`, W - 40, 60, { align: "right" });

  doc.setDrawColor(228, 223, 216); doc.line(40, 78, W - 40, 78);

  let startY = 92;
  if (summary.length) {
    doc.setFontSize(9.5);
    const line = summary.map(s => `${s.label} : ${s.value}`).join("     •     ");
    doc.setTextColor(90, 90, 90);
    doc.text(line, 40, startY);
    startY += 16;
  }

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows.map(r => r.map(c => (c == null ? "" : String(c)))),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, textColor: [40, 40, 40] },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 245, 239] },
    margin: { left: 40, right: 40 },
  });

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(170, 170, 170);
    doc.text("tabliereci.net", 40, doc.internal.pageSize.getHeight() - 24);
    doc.text(`Page ${i}/${pageCount}`, W - 40, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  return { exported: rows.length, total: totalRows, truncated };
}

/**
 * Génère un fichier Excel (.xlsx) brandé avec un tableau.
 */
export async function exportXLSX({ sheetName = "Données", title, subtitle, columns, rows, filename }) {
  const XLSX = await import("xlsx");
  const aoa = [
    ["TablièreCI"],
    [title],
    subtitle ? [subtitle] : [],
    [`Généré le ${todayStr()}`],
    [],
    columns,
    ...rows.map(r => r.map(sanitizeCell)),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Largeur de colonne sans spread (robuste pour des milliers de lignes)
  ws["!cols"] = columns.map((c, i) => {
    let w = Math.max(12, String(c).length + 2);
    for (const r of rows) { const l = String(r[i] ?? "").length + 2; if (l > w) w = l; }
    return { wch: Math.min(60, w) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/**
 * Génère un fichier CSV (compatible Excel / import CRM) et le télécharge.
 * BOM UTF-8 en tête → les accents s'affichent correctement dans Excel.
 * @param {{columns:string[], rows:(string|number)[][], filename:string, delimiter?:string}} o
 */
export function exportCSV({ columns, rows, filename, delimiter = "," }) {
  const esc = (v) => {
    const s = String(sanitizeCell(v)); // neutralise les formules (= + - @) puis échappe
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns, ...rows].map(r => r.map(esc).join(delimiter));
  const csv = "﻿" + lines.join("\r\n"); // BOM + CRLF (Excel)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
