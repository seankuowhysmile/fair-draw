import { describe, expect, it } from 'vitest';
import * as C from '../src/index.js';
import type { Table, Tables } from '../src/types.js';

function tables(count = 10, repeat = false): Tables {
  return {
    人員名單: [
      ['人員編號', '姓名', '部門', '參加抽獎'],
      ...Array.from({ length: count }, (_, i) => [String(i + 1).padStart(4, '0'), '測試同仁' + i, '測試部門', '是']),
    ] as Table,
    獎項設定: [
      ['抽獎順序', '獎項名稱', '獎品說明', '得獎人數', '每次抽出人數'],
      [1, '幸運獎', '範例', 3, 2],
      [2, '頭獎', '範例', 2, 1],
    ] as Table,
    活動設定: [
      ['設定項目', '設定值'],
      ['允許重複中獎', repeat ? '是' : '否'],
    ] as Table,
  };
}

const make = () => C.createState(C.parseTables(tables()));

describe('core', () => {
  it('valid input: IDs retain leading zero; prize ordering and quantities', () => {
    const s = make();
    expect(s.people[0]!.id).toBe('0001');
    expect(s.prizes[0]!.batch).toBe(2);
    expect(s.prizes[1]!.quantity).toBe(2);
  });

  it('duplicates are rejected, case-insensitive', () => {
    const t = tables();
    (t['人員名單']![1] as Table[number])[0] = 'A001';
    (t['人員名單']![2] as Table[number])[0] = 'a001';
    expect(() => C.parseTables(t)).toThrow(/重複/);
  });

  it('same names allowed with distinct IDs', () => {
    const t = tables();
    t['人員名單']![2]![1] = t['人員名單']![1]![1];
    expect(C.parseTables(t).warnings.length).toBe(1);
  });

  it('eligibility flags validated and excluded', () => {
    const t = tables();
    t['人員名單']![1]![3] = '否';
    const s = C.createState(C.parseTables(t));
    expect(C.eligible(s, 'P1').length).toBe(9);
    t['人員名單']![1]![3] = '待確認';
    expect(() => C.parseTables(t)).toThrow(/是/);
  });

  it('quantity overflow, fraction, zero, empty, and excessive batch rejected', () => {
    for (const bad of [0, '', -1, 1.5, 'abc', 50001]) {
      const t = tables();
      t['獎項設定']![1]![3] = bad as never;
      expect(() => C.parseTables(t)).toThrow();
    }
    const t = tables();
    t['獎項設定']![1]![4] = 4;
    expect(() => C.parseTables(t)).toThrow(/超過/);
    expect(() => C.parseTables(tables(4))).toThrow(/總名額/);
  });

  it('empty optional batch means draw full prize at once', () => {
    const t = tables();
    t['獎項設定']![1]![4] = '';
    expect(C.parseTables(t).prizes[0]!.batch).toBe(3);
  });

  it('draws exclude all earlier winners when repeat disabled', () => {
    const s = make();
    C.draw(s, 'P1', 2, () => 0);
    C.draw(s, 'P1', 1, () => 0);
    C.draw(s, 'P2', 2, () => 0);
    expect(new Set(s.results.map((r) => r.personId)).size).toBe(5);
    expect(C.remaining(s, 'P1')).toBe(0);
    expect(C.remaining(s, 'P2')).toBe(0);
    expect(C.validateState(s).results.length).toBe(5);
  });

  it('batch commit cannot exceed quota or be negative', () => {
    const s = make();
    expect(() => C.draw(s, 'P1', 4)).toThrow();
    expect(() => C.draw(s, 'P1', 0)).toThrow();
    expect(s.results.length).toBe(0);
    C.draw(s, 'P1', 3);
    expect(() => C.draw(s, 'P1', 1)).toThrow();
  });

  it('repeat permits different prizes, never same prize', () => {
    const s = C.createState(C.parseTables(tables(10, true)));
    C.draw(s, 'P1', 3, () => 0);
    expect(C.eligible(s, 'P1').length).toBe(7);
    expect(C.eligible(s, 'P2').length).toBe(10);
    C.draw(s, 'P2', 2, () => 0);
    expect(s.results[0]!.personId).toBe(s.results[3]!.personId);
    expect(C.validateState(s).results.length).toBe(5);
  });

  it('void preserves original record, releases quota, and excludes the person', () => {
    const s = make();
    C.draw(s, 'P1', 3, () => 0);
    C.voidResult(s, 1, '現場缺席');
    expect(s.results.length).toBe(3);
    expect(C.remaining(s, 'P1')).toBe(1);
    expect(C.eligible(s, 'P1').some((p) => p.id === '0001')).toBe(false);
    C.draw(s, 'P1', 1, () => 0);
    expect(C.validResults(s, 'P1').length).toBe(3);
    expect(C.validateState(s).results.length).toBe(4);
    expect(() => C.voidResult(s, 1, '再作廢')).toThrow();
  });

  it('void after earlier cross-prize win is valid', () => {
    const s = C.createState(C.parseTables(tables(10, true)));
    C.draw(s, 'P1', 1, () => 0);
    C.draw(s, 'P2', 1, () => 0);
    C.voidResult(s, 1, '事後取消');
    expect(C.validateState(s).results.length).toBe(2);
  });

  it('invalid backup relationships and duplicates are rejected', () => {
    const s = make();
    C.draw(s, 'P1', 2, () => 0);
    const bad = JSON.parse(JSON.stringify(s));
    bad.results[1].personId = bad.results[0].personId;
    expect(() => C.validateState(bad)).toThrow();
    bad.results[1].personId = 'MISSING';
    expect(() => C.validateState(bad)).toThrow();
  });

  it('sample without replacement is exhaustive for all 3 x 2 index paths', () => {
    const outcomes = new Set<string>();
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 2; b++) {
        const seq = [a, b];
        outcomes.add(C.sampleWithoutReplacement([0, 1, 2], 2, () => seq.shift()!).join(','));
      }
    expect(outcomes.size).toBe(6);
  });

  it('secure sampler returns valid and unique entries for 10,000 persons', () => {
    const people = Array.from({ length: 10000 }, (_, i) => i);
    const selected = C.sampleWithoutReplacement(people, 1000);
    expect(new Set(selected).size).toBe(1000);
    expect(selected.every((i) => i >= 0 && i < 10000)).toBe(true);
  });

  it('safe uniform bounds for non-power-of-two sizes', () => {
    for (const n of [1, 2, 3, 7, 255, 65537, 50000])
      for (let i = 0; i < 200; i++) {
        const v = C.secureInt(n);
        expect(v >= 0 && v < n && Number.isInteger(v)).toBe(true);
      }
  });
});
