import { expect, test } from 'vitest';
import type { MovePlan, ReadonlySimState } from '@sim';
import { moveLabel, moveStarted, postNote, postStatus, reportError } from './post';

const plan = (forest: number, y = 1800): MovePlan => ({ to: { x: 5200, y }, pts: [], total: 78.4, dist: 1234.4, forest });

test('F-21: 이동 문구', () => {
  expect(moveLabel(plan(0))).toBe('여기로 관측소 이동 · 1,234 m · 약 01:18');
  expect(moveLabel(plan(51))).toBe('여기로 관측소 이동 · 1,234 m · 약 01:18 · 숲 통과');
  expect(moveLabel(plan(50))).not.toContain('숲');
  expect(moveStarted(plan(120), 3650)).toEqual(['관측소 이동 시작 — 거리 1,234 m, 예상 01:18 (숲 120 m 통과).']);
  expect(moveStarted(plan(0, 3700), 3650)[1]).toBe('목적지가 아군 전선 전방입니다. 이동 중에는 발각될 확률이 높습니다.');
  const post = { state: 'moving', move: plan(0), departed: 100, until: 0, moves: 1 } as const;
  expect(postStatus({ post, tick: 500 })).toBe('관측소 이동 중 — 00:58');
  expect(postStatus({ post: { ...post, state: 'setup', until: 1100 }, tick: 500 })).toBe('관측 장비 설치 중 — 00:30');
  expect(postStatus({ post: { ...post, state: 'ready' }, tick: 500 })).toBeNull();
});

test('F-21: 발각·보고 오차 문구', () => {
  const unit = (stage: number) => [{ type: 'apc', intel: { stage, tnum: 2 } }] as unknown as ReadonlySimState['platoons'];
  expect(postNote({ what: 'compromised', pid: 0, fire: 'mortar' }, unit(0), false)[0]).toContain('아직 탐지하지 못한 적에게 발각된');
  expect(postNote({ what: 'compromised', pid: 0, fire: 'direct' }, unit(1), false)[0]).toContain('표적 2(미상)에게');
  expect(postNote({ what: 'compromised', pid: 0, fire: null }, unit(2), false)).toEqual([
    '관측소가 표적 2(장갑차)에게 발각된 것 같습니다. 곧 사격이 올 수 있습니다 — 자리를 옮기십시오.',
    '↳ 적에게 지금 관측소를 때릴 화력은 없는 것 같습니다.',
  ]);
  expect(postNote({ what: 'set_up' }, [], true)[0]).toContain('숲 속이라 시야가 가립니다');
  expect(postNote({ what: 'lost', cause: 'friendly' }, [], false)[0]).toBe('아군 포탄이 관측소에 떨어졌습니다. 관측반 전투 불능 — 임무 종료.');
  expect(reportError({ x: 0, y: 0 }, { x: 61, y: 0 }, 'standard')).toContain('약 61 m 다릅니다');
  expect(reportError({ x: 0, y: 0 }, { x: 60, y: 0 }, 'standard')).toBeNull();
  expect(reportError({ x: 0, y: 0 }, { x: 7, y: 0 }, 'training')).toBe('↳ (훈련) 보고 위치 오차 7 m.');
});
