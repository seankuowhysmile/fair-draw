import { makeId } from './draw.js';
import { bounded, fail, parseTables } from './parse.js';
import type { EventState, ParsedEvent, Table, Tables } from './types.js';

export const VERSION = 1;

/** The subset of a parsed/existing event that's enough to start a new event from (see `resetEvent`, which reuses the same roster). */
export type NewEventInput = Pick<ParsedEvent, 'people' | 'prizes' | 'settings' | 'sourceName' | 'isDemo'>;

export function createState(parsed: NewEventInput): EventState {
  const now = new Date().toISOString();
  return {
    version: VERSION,
    eventId: makeId(),
    revision: 0,
    createdAt: now,
    sourceName: parsed.sourceName || '',
    isDemo: !!parsed.isDemo,
    settings: { ...parsed.settings },
    people: parsed.people.map((p) => ({ ...p })),
    prizes: parsed.prizes.map((p) => ({ ...p })),
    selectedPrize: parsed.prizes[0]!.id,
    results: [],
    lastBatchId: null,
    audit: [{ at: now, action: '建立活動', detail: '人員 ' + parsed.people.length + '；獎項 ' + parsed.prizes.length }],
  };
}

/** Rebuilds the input tables and checks every result relationship. The JSON itself is never executed. */
export function validateState(s: unknown): EventState {
  const state = s as EventState;
  if (!state || state.version !== VERSION || typeof state.eventId !== 'string' || state.eventId.length > 100)
    fail('備份格式或版本不正確。');
  if (!state.settings || !Array.isArray(state.people) || !Array.isArray(state.prizes) || !Array.isArray(state.results))
    fail('備份缺少必要資料。');
  if (state.people.length > 50000 || state.prizes.length > 500 || state.results.length > 100000)
    fail('備份資料量超過限制。');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) fail('備份版本序號不正確。');
  for (const key of ['allowRepeat', 'sound', 'showDept', 'showId'] as const)
    if (typeof state.settings[key] !== 'boolean') fail('備份的活動設定格式不正確。');

  const t: Tables = {
    人員名單: [
      ['人員編號', '姓名', '部門', '參加抽獎'],
      ...state.people.map((p) => [p.id, p.name, p.dept, p.active ? '是' : '否']),
    ] as Table,
    獎項設定: [
      ['抽獎順序', '獎項名稱', '獎品說明', '得獎人數', '每次抽出人數'],
      ...state.prizes.map((p) => [p.order, p.name, p.description, p.quantity, p.batch]),
    ] as Table,
    活動設定: [
      ['設定項目', '設定值'],
      ['活動名稱', state.settings.title],
      ['活動副標', state.settings.subtitle],
      ['允許重複中獎', state.settings.allowRepeat ? '是' : '否'],
    ] as Table,
  };
  const parsed = parseTables(t, state.sourceName);
  if (state.prizes.some((p, i) => p.id !== parsed.prizes[i]!.id)) fail('備份獎項編號或順序不一致。');
  if (state.people.some((p) => typeof p.active !== 'boolean')) fail('備份的人員資格格式不正確。');

  const persons = new Map(state.people.map((p) => [p.id, p]));
  const prizes = new Map(state.prizes.map((p) => [p.id, p]));
  if (!prizes.has(state.selectedPrize)) fail('備份的目前獎項不存在。');

  const seen = new Set<string>();
  const globalSeen = new Set<string>();
  const counts = new Map<string, number>();
  const batches = new Map<string, { prizeId: string; size: number; at: string; eligible: number; count: number }>();
  const voidTimes = new Map<string, number>();
  for (const r of state.results)
    if (r.status === 'void') {
      const t = Date.parse(r.voidAt);
      if (Number.isFinite(t)) voidTimes.set(r.personId, Math.min(voidTimes.get(r.personId) ?? Infinity, t));
    }

  state.results.forEach((r, index) => {
    if (r.id !== index + 1 || typeof r.batchId !== 'string' || r.batchId.length > 64 || !persons.has(r.personId) || !prizes.has(r.prizeId))
      fail('備份中的得獎紀錄關聯不正確。');
    if (!persons.get(r.personId)!.active || !['valid', 'void'].includes(r.status) || !Number.isFinite(Date.parse(r.drawnAt)))
      fail('備份中的得獎資料格式不正確。');
    if (
      !Number.isInteger(r.batchSize) ||
      r.batchSize < 1 ||
      !Number.isInteger(r.eligibleCount) ||
      r.eligibleCount < r.batchSize ||
      r.eligibleCount > state.people.length
    )
      fail('備份中的抽獎人數不正確。');
    const key = r.prizeId + '\u0000' + r.personId;
    if (
      seen.has(key) ||
      (!state.settings.allowRepeat && globalSeen.has(r.personId)) ||
      (voidTimes.has(r.personId) && Date.parse(r.drawnAt) > voidTimes.get(r.personId)!)
    )
      fail('備份出現不符合規則的重複中獎。');
    seen.add(key);
    globalSeen.add(r.personId);
    if (r.status === 'void') {
      bounded(r.voidReason, '備份的作廢理由', 200);
      if (!Number.isFinite(Date.parse(r.voidAt))) fail('作廢時間不正確。');
    } else counts.set(r.prizeId, (counts.get(r.prizeId) || 0) + 1);
    if (batches.has(r.batchId)) {
      const b = batches.get(r.batchId)!;
      if (b.prizeId !== r.prizeId || b.size !== r.batchSize || b.at !== r.drawnAt || b.eligible !== r.eligibleCount)
        fail('同輪開獎資料不一致。');
      b.count++;
    } else batches.set(r.batchId, { prizeId: r.prizeId, size: r.batchSize, at: r.drawnAt, eligible: r.eligibleCount, count: 1 });
  });

  for (const [id, n] of counts) if (n > prizes.get(id)!.quantity) fail('備份得獎人数超出獎項名額。');
  for (const b of batches.values()) if (b.size !== b.count) fail('備份有未完整記錄的開獎輪次。');
  if (state.lastBatchId !== null && !batches.has(state.lastBatchId)) fail('備份的最後一輪編號不正確。');
  if (!Array.isArray(state.audit) || state.audit.length > 100001) fail('備份操作紀錄不正確。');
  for (const a of state.audit) {
    if (!a || !Number.isFinite(Date.parse(a.at)) || typeof a.action !== 'string' || a.action.length > 120 || typeof a.detail !== 'string' || a.detail.length > 1000)
      fail('備份操作紀錄格式不正確。');
  }

  const clean: EventState = JSON.parse(JSON.stringify(state));
  clean.sourceName = bounded(clean.sourceName, '來源檔名', 240, false);
  clean.isDemo = !!clean.isDemo || parsed.isDemo;
  return clean;
}
