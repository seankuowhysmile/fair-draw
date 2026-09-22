import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbook } from '../src/read.js';
import { writeWorkbook } from '../src/write.js';

const templatePath = fileURLToPath(new URL('../../examples/sample/抽獎設定範本.xlsx', import.meta.url));

describe('xlsx-io', () => {
  it('round-trips a written workbook back into the same table shape', () => {
    const bytes = writeWorkbook([
      {
        name: '人員名單',
        rows: [
          ['人員編號', '姓名', '部門', '參加抽獎'],
          ['0001', '測試同仁0', '測試部門', '是'],
          ['0002', '測試同仁1', '測試部門', '否'],
        ],
        widths: [12, 18, 18, 12],
      },
    ]);
    const tables = readWorkbook(bytes);
    expect(tables['人員名單']).toEqual([
      ['人員編號', '姓名', '部門', '參加抽獎'],
      ['0001', '測試同仁0', '測試部門', '是'],
      ['0002', '測試同仁1', '測試部門', '否'],
    ]);
  });

  it('rejects merged cells', () => {
    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['人員編號', '姓名'],
      ['0001', '測試'],
    ]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(workbook, ws, '人員名單');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
    expect(() => readWorkbook(bytes)).toThrow(/合併儲存格/);
  });

  it('rejects formula cells', () => {
    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['人員編號', '姓名'],
      ['0001', '測試'],
    ]);
    ws['B2'] = { t: 'str', v: '測試', f: 'A2' };
    XLSX.utils.book_append_sheet(workbook, ws, '人員名單');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
    expect(() => readWorkbook(bytes)).toThrow(/公式/);
  });

  it('parses the real 抽獎設定範本.xlsx fixture', () => {
    const bytes = readFileSync(templatePath);
    const tables = readWorkbook(bytes);
    expect(tables['人員名單']?.[0]).toContain('人員編號');
    expect(tables['人員名單']?.[0]).toContain('姓名');
    expect(tables['獎項設定']?.[0]).toContain('獎項名稱');
    expect(tables['獎項設定']?.[0]).toContain('得獎人數');
    expect((tables['人員名單']?.length ?? 0) - 1).toBeGreaterThan(0);
  });
});
