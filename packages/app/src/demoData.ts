import type { Table, Tables } from '@fairdraw/core';

/**
 * Small built-in demo dataset shown on first launch, before a real Excel
 * workbook is imported. Names are prefixed with "示範人員" so `@fairdraw/core`
 * flags the resulting event as demo data (see CONTEXT.md: 示範資料).
 */
export function demoTables(): Tables {
  const people: Table = [
    ['人員編號', '姓名', '部門', '參加抽獎'],
    ...Array.from({ length: 20 }, (_, i) => [
      String(i + 1).padStart(4, '0'),
      '示範人員' + (i + 1),
      i % 2 === 0 ? '示範部門 A' : '示範部門 B',
      '是',
    ]),
  ];
  const prizes: Table = [
    ['抽獎順序', '獎項名稱', '獎品說明', '得獎人數', '每次抽出人數'],
    [1, '幸運獎', '示範獎品', 5, 1],
    [2, '頭獎', '示範獎品', 1, 1],
  ];
  const settings: Table = [
    ['設定項目', '設定值'],
    ['活動名稱', 'FairDraw 示範活動'],
    ['活動副標', '匯入 Excel 以取代這份示範資料'],
  ];
  return { 人員名單: people, 獎項設定: prizes, 活動設定: settings };
}
