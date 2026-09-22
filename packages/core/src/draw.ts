import { bounded, fail } from './parse.js';
import type { EventState, Person, RandomInt, WinnerRecord } from './types.js';

export function secureInt(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 0x100000000) fail('隨機範圍無效。');
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function')
    fail('此瀏覽器無法提供安全亂數。請使用電腦版 Chrome 或 Edge。');
  const value = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0]! >= limit);
  return value[0]! % n;
}

export function sampleWithoutReplacement<T>(items: T[], count: number, rng: RandomInt = secureInt): T[] {
  if (!Number.isInteger(count) || count < 1 || count > items.length) fail('抽獎人數超出可抽選範圍。');
  const pool = items.slice();
  for (let i = 0; i < count; i++) {
    const j = i + rng(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

export function makeId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Array.from({ length: 4 }, () => secureInt(65536).toString(16).padStart(4, '0')).join('')
  );
}

export function prizeById(s: EventState, id: string) {
  return s.prizes.find((p) => p.id === id);
}

export function validResults(s: EventState, prizeId?: string): WinnerRecord[] {
  return s.results.filter((r) => r.status === 'valid' && (!prizeId || r.prizeId === prizeId));
}

export function remaining(s: EventState, prizeId: string): number {
  const p = prizeById(s, prizeId);
  if (!p) fail('找不到獎項。');
  return p.quantity - validResults(s, prizeId).length;
}

export function eligible(s: EventState, prizeId: string): Person[] {
  const blocked = new Set(
    s.results.filter((r) => r.status === 'void' || !s.settings.allowRepeat || r.prizeId === prizeId).map((r) => r.personId),
  );
  return s.people.filter((p) => p.active && !blocked.has(p.id));
}

/** Called exactly once on STOP. Winners are committed before the reveal animation runs. */
export function draw(s: EventState, prizeId: string, count: number, rng: RandomInt = secureInt): WinnerRecord[] {
  if (!Number.isInteger(count) || count < 1) fail('本輪人數必須是正整數。');
  if (count > remaining(s, prizeId)) fail('本輪人數超過此獎剩餘名額。');
  const pool = eligible(s, prizeId);
  if (count > pool.length) fail('符合資格的人數只剩 ' + pool.length + '，不足以抽出 ' + count + ' 人。請先檢查規則及本輪人數。');
  const winners = sampleWithoutReplacement(pool, count, rng);
  const at = new Date().toISOString();
  const batchId = 'B' + (s.results.length + 1);
  const first = s.results.length + 1;
  const added: WinnerRecord[] = winners.map((p, i) => ({
    id: first + i,
    batchId,
    prizeId,
    personId: p.id,
    drawnAt: at,
    eligibleCount: pool.length,
    batchSize: count,
    status: 'valid',
    voidReason: '',
    voidAt: '',
  }));
  s.results.push(...added);
  s.lastBatchId = batchId;
  s.selectedPrize = prizeId;
  s.revision++;
  s.audit.push({ at, action: '抽出得獎者', detail: prizeById(s, prizeId)!.name + ' / ' + count + ' 人 / ' + batchId });
  return added;
}

export function voidResult(s: EventState, id: number, reason: string): WinnerRecord {
  const r = s.results.find((r) => r.id === id);
  if (!r || r.status !== 'valid') fail('此紀錄不存在，或已作廢。');
  const boundedReason = bounded(reason, '作廢理由', 200);
  r.status = 'void';
  r.voidReason = boundedReason;
  r.voidAt = new Date().toISOString();
  s.revision++;
  s.audit.push({ at: r.voidAt, action: '得獎作廢', detail: '紀錄 ' + id + ' / ' + boundedReason });
  return r;
}
