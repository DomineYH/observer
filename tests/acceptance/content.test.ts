import { expect, test } from 'vitest';
import { BASE_GUNS } from '@content/guns';
import { contentOf } from '@content/lookup';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { BASE_SCENARIO } from '@content/scenario';

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
