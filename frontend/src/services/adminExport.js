/**
 * Export admin brandé (PDF / Excel) — même présentation que l'espace restaurateur.
 * Récupère les données JSON du backend puis délègue à exports.js.
 */
import { adminService } from "./admin.service.js";
import { exportPDF, exportXLSX } from "./exports.js";

// jsPDF-autotable devient très lent au-delà de quelques milliers de lignes :
// on plafonne le PDF et on renvoie vers l'Excel pour la liste intégrale.
const PDF_MAX = 2500;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const fmtCell = (v) => {
  if (v == null) return "";
  if (typeof v === "string" && ISO_RE.test(v)) {
    return new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return v;
};

/**
 * @param {"restaurants"|"users"|"reservations"|"contacts"} type
 * @param {"pdf"|"xls"} kind
 * @param {{title:string, filename:string}} meta
 */
export async function runAdminExport(type, kind, { title, filename }) {
  const { headers, rows } = await adminService.exportData(type);
  const arr = (rows || []).map(r => Object.values(r).map(fmtCell));

  if (kind === "xls") {
    await exportXLSX({
      sheetName: title.slice(0, 31), title, subtitle: "Espace administration",
      columns: headers, rows: arr, filename,
    });
    return { total: arr.length, exported: arr.length };
  }

  // PDF (plafonné)
  const capped = arr.length > PDF_MAX ? arr.slice(0, PDF_MAX) : arr;
  const subtitle = arr.length > PDF_MAX
    ? `Espace administration · ${PDF_MAX} premières lignes sur ${arr.length} — liste complète en Excel`
    : "Espace administration";
  await exportPDF({
    title, subtitle, columns: headers, rows: capped, filename,
    summary: [{ label: "Total", value: arr.length }],
  });
  return { total: arr.length, exported: capped.length };
}
