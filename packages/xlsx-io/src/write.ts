import * as XLSX from 'xlsx';
import type { SheetSpec } from './types.js';

/** Builds a fresh .xlsx workbook (no formulas, no macros) from plain row data. */
export function writeWorkbook(sheets: SheetSpec[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) ws['!cols'] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}
