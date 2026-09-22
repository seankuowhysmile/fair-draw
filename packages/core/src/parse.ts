import type { Cell, ParsedEvent, Person, Prize, Row, Settings, Table, Tables } from './types.js';

export const defaults: Settings = {
  title: 'FairDraw 幸運抽獎',
  subtitle: '每一份努力，都值得被看見',
  allowRepeat: false,
  sound: true,
  showDept: true,
  showId: true,
};

export const text = (v: Cell): string => String(v == null ? '' : v).trim().normalize('NFC');

export function fail(message: string): never {
  throw new Error(message);
}

function yesno(v: Cell, label: string, fallback = true): boolean {
  const s = text(v).toLowerCase();
  if (!s) return fallback;
  if (['是', 'yes', 'y', '1', 'true'].includes(s)) return true;
  if (['否', 'no', 'n', '0', 'false'].includes(s)) return false;
  return fail(label + ' 請填「是」或「否」，不要使用其他文字。');
}

function integer(v: Cell, label: string, max = 50000): number {
  const s = text(v);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s)) fail(label + ' 必須是正整數。');
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isSafeInteger(n) || n < 1 || n > max) fail(label + ' 必須介於 1～' + max.toLocaleString() + '。');
  return n;
}

export function bounded(v: Cell, label: string, max: number, required = true): string {
  const s = text(v);
  if (required && !s) fail(label + ' 不可空白。');
  if (s.length > max) fail(label + ' 太長，請控制在 ' + max + ' 個字元以內。');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) fail(label + ' 含有不支援的控制字元。');
  return s;
}

function headers(rows: Table | undefined, aliases: Record<string, string[]>, sheet: string): Record<string, number> {
  if (!rows || !rows.length) fail('找不到「' + sheet + '」工作表，或工作表沒有資料。');
  const first = rows[0]!.map(text);
  const map: Record<string, number> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const hits = first.map((x, i) => (names.includes(x) ? i : -1)).filter((i) => i >= 0);
    if (hits.length > 1) fail('「' + sheet + '」有重複欄位：' + names[0]);
    map[key] = hits.length ? hits[0]! : -1;
  }
  return map;
}

const cell = (row: Row, index: number): Cell => (index < 0 ? '' : row[index]);

export function parseTables(tables: Tables, sourceName = ''): ParsedEvent {
  const pRows = tables['人員名單'] || tables['參加人員'] || tables['名單'];
  const aRows = tables['獎項設定'] || tables['獎項'];
  const ph = headers(
    pRows,
    { id: ['人員編號', '員工編號', '編號'], name: ['姓名', '人員姓名'], dept: ['部門', '單位'], active: ['參加抽獎', '是否參加'] },
    '人員名單',
  );
  if (ph.id! < 0 || ph.name! < 0) fail('「人員名單」第一列必須包含「人員編號」和「姓名」。');

  const people: Person[] = [];
  const idSet = new Set<string>();
  const nameCounts = new Map<string, number>();
  pRows!.slice(1).forEach((row, index) => {
    if (!row.some((v) => text(v))) return;
    const loc = '人員名單第 ' + (index + 2) + ' 列';
    const id = bounded(cell(row, ph.id!), loc + '的人員編號', 64);
    const name = bounded(cell(row, ph.name!), loc + '的姓名', 80);
    const key = id.normalize('NFKC').toLowerCase();
    if (idSet.has(key)) fail(loc + '的人員編號「' + id + '」重複（不區分大小寫／全半形）。同名者也必須有不同編號。');
    idSet.add(key);
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    people.push({
      id,
      name,
      dept: bounded(cell(row, ph.dept!), loc + '的部門', 80, false),
      active: yesno(cell(row, ph.active!), loc + '的參加抽獎'),
    });
  });
  if (!people.length || people.length > 50000) fail('人員名單必須有 1～50,000 人。');

  const ah = headers(
    aRows,
    {
      order: ['抽獎順序', '順序', '序號'],
      name: ['獎項名稱', '獎項'],
      description: ['獎品說明', '獎品'],
      quantity: ['得獎人數', '名額', '人數'],
      batch: ['每次抽出人數', '每輪人數', '每次人數'],
    },
    '獎項設定',
  );
  if (ah.name! < 0 || ah.quantity! < 0) fail('「獎項設定」第一列必須包含「獎項名稱」和「得獎人數」。');

  const prizes: Prize[] = [];
  const orders = new Set<number>();
  const prizeNames = new Set<string>();
  aRows!.slice(1).forEach((row, index) => {
    if (!row.some((v) => text(v))) return;
    const loc = '獎項設定第 ' + (index + 2) + ' 列';
    const order = text(cell(row, ah.order!)) ? integer(cell(row, ah.order!), loc + '的抽獎順序', 99999) : index + 1;
    const name = bounded(cell(row, ah.name!), loc + '的獎項名稱', 60);
    const quantity = integer(cell(row, ah.quantity!), loc + '的得獎人數');
    const batch = text(cell(row, ah.batch!)) ? integer(cell(row, ah.batch!), loc + '的每次抽出人數') : quantity;
    if (batch > quantity) fail(loc + '的每次抽出人數不可超過得獎人數。');
    if (orders.has(order)) fail('抽獎順序 ' + order + ' 重複，請改成不同的正整數。');
    if (prizeNames.has(name)) fail('獎項名稱「' + name + '」重複，請給不同獎項不同名稱。');
    orders.add(order);
    prizeNames.add(name);
    prizes.push({
      id: 'P' + order,
      order,
      name,
      description: bounded(cell(row, ah.description!), loc + '的獎品說明', 180, false),
      quantity,
      batch,
    });
  });
  if (!prizes.length || prizes.length > 500) fail('必須設定 1～500 個獎項。');
  prizes.sort((a, b) => a.order - b.order);

  const settings: Settings = { ...defaults };
  const sRows = tables['活動設定'];
  if (sRows) {
    const sh = headers(sRows, { key: ['設定項目', '項目'], value: ['設定值', '值'] }, '活動設定');
    if (sh.key! < 0 || sh.value! < 0) fail('「活動設定」第一列須有「設定項目」與「設定值」。');
    const keys = new Set<string>();
    sRows.slice(1).forEach((row) => {
      const k = text(cell(row, sh.key!));
      const v = cell(row, sh.value!);
      if (!k) return;
      if (keys.has(k)) fail('活動設定「' + k + '」重複。');
      keys.add(k);
      if (k === '活動名稱') settings.title = bounded(v, '活動名稱', 100);
      if (k === '活動副標') settings.subtitle = bounded(v, '活動副標', 140, false);
      const bools: Record<string, keyof Settings> = {
        允許重複中獎: 'allowRepeat',
        音效: 'sound',
        顯示部門: 'showDept',
        顯示編號: 'showId',
      };
      const boolKey = bools[k];
      if (boolKey) (settings[boolKey] as boolean) = yesno(v, k, defaults[boolKey] as boolean);
    });
  }

  const active = people.filter((p) => p.active).length;
  if (!active) fail('目前沒有符合抽獎資格的人員，請將「參加抽獎」設為「是」。');
  const total = prizes.reduce((s, p) => s + p.quantity, 0);
  if (total > 50000) fail('本版本的獎項總名額上限為 50,000。');
  if (!settings.allowRepeat && total > active)
    fail('獎項總名額 ' + total + ' 超過可參加人數 ' + active + '；目前設定為每人限中一次。請減少名額、增加人員，或在活動設定允許跨獎項中獎。');
  if (settings.allowRepeat && prizes.some((p) => p.quantity > active))
    fail('同一獎項不可重複中獎，因此每項名額不得超過可參加人數 ' + active + '。');

  const warnings: string[] = [];
  const sameNames = [...nameCounts].filter(([, n]) => n > 1).length;
  if (sameNames) warnings.push('有 ' + sameNames + ' 組同名人員，以人員編號區別，建議顯示編號。');
  const isDemo = people.some((p) => /^(範例|示範人員)/.test(p.name));
  if (isDemo) warnings.push('仍含範例姓名，匯入後將標記為「示範資料」。正式活動前請替換所有範例。');
  if (people.length > 260) warnings.push('球面只輪播部分姓名以保持動畫流暢；實際抽選涵蓋全部符合資格的人員。');

  return { people, prizes, settings, isDemo, sourceName, warnings, active, total };
}
