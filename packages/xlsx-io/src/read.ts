import * as XLSX from 'xlsx';
import type { Table, Tables } from './types.js';

const ALLOWED_SHEETS = new Set(['人員名單', '參加人員', '名單', '獎項設定', '獎項', '活動設定']);
const MAX_ROWS = 50000;

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Reads the raffle-relevant sheets out of an .xlsx workbook into plain
 * table arrays (header row + data rows), matching the shape `@fairdraw/core`'s
 * `parseTables` expects. Formulas, merged cells and Excel error values are
 * rejected outright — this is a data importer, not a spreadsheet engine.
 */
export function readWorkbook(data: ArrayBuffer | Uint8Array): Tables {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 22) fail('檔案不是有效的 .xlsx，請用 Excel 另存為 .xlsx。');

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array' });
  } catch {
    fail('無法讀取 .xlsx。請確認不是舊版 .xls、密碼保護檔或已損壞的檔案。');
  }

  const tables: Tables = {};
  for (const name of workbook.SheetNames) {
    const trimmed = name.trim();
    if (!ALLOWED_SHEETS.has(trimmed)) continue;
    if (tables[trimmed]) fail('工作表名稱重複。');

    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    if (sheet['!merges']?.length) fail('「' + trimmed + '」不能含合併儲存格。請取消合併，並保留第一列欄位標題。');

    for (const addr of Object.keys(sheet)) {
      if (addr.startsWith('!')) continue;
      const cellObj = sheet[addr] as XLSX.CellObject;
      if (cellObj.f) fail('「' + trimmed + '」' + addr + ' 含有公式，請先複製並「貼上為值」。');
      if (cellObj.t === 'e') fail('「' + trimmed + '」' + addr + ' 含有 Excel 錯誤值。');
    }

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    }) as Table;
    if (rows.length > MAX_ROWS) fail('「' + trimmed + '」超過 ' + MAX_ROWS.toLocaleString() + ' 筆資料列，請刪除多餘列或格式。');
    tables[trimmed] = rows;
  }
  return tables;
}
