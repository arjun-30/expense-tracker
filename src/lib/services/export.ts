import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ExportColumn {
  key: string;
  header: string;
}

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toLocaleDateString("en-IN");
  return String(v);
}

export function toCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): string {
  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = columns.map((c) => escape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(cell(row, c.key))).join(","));
  return [header, ...lines].join("\n");
}

export async function toExcel(rows: Record<string, unknown>[], columns: ExportColumn[], sheetName = "Report"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(columns.reduce((acc, c) => ({ ...acc, [c.key]: cell(row, c.key) }), {} as Record<string, string>));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function toPdf(title: string, rows: Record<string, unknown>[], columns: ExportColumn[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 792; // landscape letter
  const pageHeight = 612;
  const margin = 36;
  const rowHeight = 16;
  const colWidth = (pageWidth - margin * 2) / columns.length;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function drawHeader() {
    page.drawText(title, { x: margin, y, size: 14, font: boldFont, color: rgb(0, 0, 0) });
    y -= 24;
    columns.forEach((c, i) => {
      page.drawText(c.header, { x: margin + i * colWidth, y, size: 8, font: boldFont });
    });
    y -= rowHeight;
  }

  drawHeader();

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    columns.forEach((c, i) => {
      const text = cell(row, c.key).slice(0, 40);
      page.drawText(text, { x: margin + i * colWidth, y, size: 8, font });
    });
    y -= rowHeight;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
