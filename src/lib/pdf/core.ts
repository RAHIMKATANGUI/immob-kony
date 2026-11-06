import "server-only";
import PdfPrinter from "pdfmake";
import type { Content, TDocumentDefinitions, StyleDictionary } from "pdfmake/interfaces";
import QRCode from "qrcode";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

export const COLORS = {
  night: "#0b1222",
  turquoise: "#14b8a6",
  slate: "#475569",
  muted: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f6f5f2",
};

export const styles: StyleDictionary = {
  h1: { fontSize: 18, bold: true, color: COLORS.night },
  h2: { fontSize: 12, bold: true, color: COLORS.night, margin: [0, 14, 0, 6] },
  label: { fontSize: 8, color: COLORS.muted, bold: true },
  value: { fontSize: 10, color: COLORS.night },
  small: { fontSize: 8, color: COLORS.slate },
  th: { bold: true, fontSize: 9, color: "#ffffff", fillColor: COLORS.night },
  td: { fontSize: 9, color: COLORS.night },
};

/** Les polices standards PDF (WinAnsi) ne gèrent pas certains caractères Unicode. */
export function pdfText(s: string | null | undefined) {
  return (s ?? "-")
    .replace(/[\u202F\u00A0\u2009]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/m\u00B2/g, "m2");
}

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: COLORS.night, light: "#ffffff" } });
}

/** Récupère une image distante (Cloudinary) en data URL JPEG/PNG compatible pdfmake. */
export async function imageDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/png")) return url;
  if (!url.startsWith("https://")) return null;
  try {
    const src = url.includes("res.cloudinary.com") ? url.replace("/upload/", "/upload/f_jpg,w_400,q_auto/") : url;
    const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/image\/(jpeg|png)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function headerBand(agency: string, title: string, subtitle?: string): Content {
  return {
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            stack: [
              { text: [{ text: "IMMOB ", color: "#ffffff" }, { text: "KONY", color: "#2dd4bf" }], bold: true, fontSize: 14, characterSpacing: 1.5 },
              { text: pdfText(agency), color: "#cbd5e1", fontSize: 8, margin: [0, 2, 0, 0] },
            ],
            margin: [14, 12, 0, 12],
          },
          {
            stack: [
              { text: pdfText(title), color: "#ffffff", bold: true, fontSize: 12, alignment: "right" },
              ...(subtitle ? [{ text: pdfText(subtitle), color: "#2dd4bf", fontSize: 9, alignment: "right" as const, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
            ],
            margin: [0, 12, 14, 12],
          },
        ],
      ],
    },
    layout: { fillColor: () => COLORS.night, hLineWidth: () => 0, vLineWidth: () => 0 },
    margin: [0, 0, 0, 18],
  };
}

export function field(label: string, value: string | number | null | undefined): Content {
  return { stack: [{ text: label.toUpperCase(), style: "label" }, { text: pdfText(value === null || value === undefined || value === "" ? "—" : String(value)), style: "value", margin: [0, 2, 0, 8] }] };
}

export function fieldGrid(items: [string, string | number | null | undefined][], cols = 3): Content {
  const rows: Content[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols).map(([l, v]) => field(l, v));
    while (row.length < cols) row.push({ text: "" });
    rows.push(row);
  }
  return { table: { widths: Array(cols).fill("*"), body: rows }, layout: "noBorders" };
}

export function dataTable(headers: string[], rows: (string | number)[][], widths?: (string | number)[]): Content {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [headers.map((h) => ({ text: pdfText(h), style: "th" })), ...rows.map((r) => r.map((c) => ({ text: pdfText(String(c)), style: "td" })))],
    },
    layout: {
      hLineColor: () => COLORS.line,
      vLineWidth: () => 0,
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      fillColor: (i: number) => (i > 0 && i % 2 === 0 ? "#f8fafc" : null),
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
}

export function renderPdf(def: Omit<TDocumentDefinitions, "defaultStyle"> & { defaultStyle?: TDocumentDefinitions["defaultStyle"] }): Promise<Buffer> {
  const doc = printer.createPdfKitDocument({
    pageSize: "A4",
    pageMargins: [36, 36, 36, 48],
    styles,
    ...def,
    defaultStyle: { font: "Helvetica", fontSize: 10, color: COLORS.night, ...(def.defaultStyle ?? {}) },
    footer: def.footer ?? ((page: number, count: number) => ({
      columns: [
        { text: `Généré par IMMOB KONY le ${new Date().toLocaleDateString("fr-FR")}`, style: "small", margin: [36, 12, 0, 0] },
        { text: `Page ${page} / ${count}`, style: "small", alignment: "right", margin: [0, 12, 36, 0] },
      ],
    })),
  });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function pdfResponse(buf: Buffer, filename: string, inline = true) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
