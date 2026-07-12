/**
 * Exports PDF / Excel brandés TablièreCI.
 * Les libs (jspdf, xlsx) sont importées dynamiquement → aucun impact sur le bundle initial.
 */

const AMBER = [232, 160, 69];
const DARK  = [30, 46, 40];

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
export async function exportPDF({ title, subtitle, columns, rows, filename, summary = [] }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

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
    ...rows.map(r => r.map(c => (c == null ? "" : c))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c, i) => ({ wch: Math.max(12, String(c).length + 2, ...rows.map(r => String(r[i] ?? "").length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
