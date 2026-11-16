import { expect, test } from 'vitest';
import { BASE_GUNS } from '@content/guns';
import { contentOf } from '@content/lookup';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { BASE_SCENARIO } from '@content/scenario';
import { mismatches, valueHash } from './expected';

const piece = { id: 'x', version: 1, list: [1, 2], nested: { a: 1, b: 2 } };
const rows = { 'guns x@1': valueHash(piece) };

test('자료: 기대값 표 — 값을 바꾼 자료가 걸린다', () => {
  // SHA-256 of {"a":[2,1],"b":1}: the measure itself, so it cannot drift under the rows.
  expect(valueHash({ b: 1, a: [2, 1] })).toBe('96cdeb5c78442219cb2cce1e0c5803b330d6a126f5e3eb79b1c9f3eb7e00e911');
  // SHA-256 of {"10":"ten","2":"two","n":{"10":2,"2":1}}: integer-like keys sort as text too, at every depth.
  expect(valueHash({ '2': 'two', '10': 'ten', n: { '2': 1, '10': 2 } })).toBe('f4b5976bd43eff10063fd7060db6222565c4ad1ae453dc2afc1876c42e9dc821');
  expect(mismatches(rows, { 'guns x@1': piece })).toEqual([]);
  expect(mismatches(rows, { 'guns x@1': { nested: { b: 2, a: 1 }, list: [1, 2], version: 1, id: 'x' } })).toEqual([]); // key order is not a value
  const changed = { ...piece, nested: { a: 1.5, b: 2 } };
  expect(mismatches(rows, { 'guns x@1': changed })).toEqual([{ key: 'guns x@1', problem: 'changed', row: rows['guns x@1'], actual: valueHash(changed) }]);
  const reordered = { ...piece, list: [2, 1] }; // array order is a value
  expect(mismatches(rows, { 'guns x@1': reordered })).toEqual([{ key: 'guns x@1', problem: 'changed', row: rows['guns x@1'], actual: valueHash(reordered) }]);
});

test('자료: 기대값 표 — 빠진 줄이 걸린다', () => {
  expect(mismatches({}, { 'guns x@1': piece })).toEqual([{ key: 'guns x@1', problem: 'missing', actual: valueHash(piece) }]);
});

test('자료: 기대값 표 — 남는 줄이 걸린다', () => {
  expect(mismatches({ ...rows, 'guns gone@1': valueHash(piece) }, { 'guns x@1': piece })).toEqual([{ key: 'guns gone@1', problem: 'extra', row: valueHash(piece) }]);
});

test('자료: 찾기 함수는 모르는 식별자와 다른 버전을 이름을 대며 거부한다', () => {
  const base = { id: 'base', version: 1 };
  const found = contentOf({ scenario: base, guns: base });
  expect(found.scenario).toBe(BASE_SCENARIO);
  expect(found.guns).toBe(BASE_GUNS);
  expect(contentOf({ scenario: { id: 'base-mungyeong', version: 2 }, guns: base }).scenario).toBe(MUNGYEONG_PLACEMENT.scenario);
  // Ids no later slice adds: a real one (apc-mungyeong, k9) would turn this red when it arrives.
  expect(() => contentOf({ scenario: { id: 'nowhere', version: 1 }, guns: base })).toThrow('scenario nowhere: unknown id');
  expect(() => contentOf({ scenario: { id: 'base', version: 2 }, guns: base })).toThrow('scenario base@2: unknown version (this build has base@1)');
  expect(() => contentOf({ scenario: base, guns: { id: 'nogun', version: 1 } })).toThrow('guns nogun: unknown id');
  expect(() => contentOf({ scenario: base, guns: { id: 'base', version: 2 } })).toThrow('guns base@2: unknown version (this build has base@1)');
});
