import "server-only";
import ExcelJS from "exceljs";

export interface Column<T> { header: string; value: (row: T) => string | number | null | undefined; width?: number }

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // protection contre l'injection de formules (CSV injection)
  const isNumeric = /^[+-]?[\d\s().]+$/.test(s); // téléphones, montants
  const safe = !isNumeric && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV au format Excel FR (séparateur « ; », BOM UTF-8). */
export function toCsv<T>(rows: T[], cols: Column<T>[]) {
  const lines = [cols.map((c) => csvCell(c.header)).join(";")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(c.value(r))).join(";"));
  return "﻿" + lines.join("\r\n");
}

export async function toXlsx<T>(title: string, rows: T[], cols: Column<T>[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "IMMOB KONY";
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = cols.map((c) => ({ header: c.header, key: c.header, width: c.width ?? 20 }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1222" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (const r of rows) ws.addRow(cols.map((c) => c.value(r) ?? ""));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
