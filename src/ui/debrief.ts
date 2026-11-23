// 사후강평 (demo lines 1354–1366, 1531–1550): the ui's words for an ended game's units, missions and record. Pure.
import type { Effect, ReadonlySimState } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { clock } from './clock';
import { RANGING_NOTE } from './post';
import type { LogLine } from './RadioLog';

type Platoons = ReadonlySimState['platoons'];

/** 적 1소대, 적 2소대 … in the scenario's order, and 적 정찰조 · 적 장갑차 · 적 박격포반: these take a number (적 장갑차 1,
 * 적 장갑차 2 …) only when the game has two or more of the kind. */
export function unitName(platoons: Platoons, pid: number): string {
  const p = platoons[pid]!;
  const nth = platoons.slice(0, pid + 1).filter((q) => q.type === p.type).length; // its place among its kind, in list order
  if (p.type === 'inf') return `적 ${nth}소대`;
  const name = { recon: '적 정찰조', apc: '적 장갑차', mortar: '적 박격포반' }[p.type];
  return platoons.filter((q) => q.type === p.type).length > 1 ? `${name} ${nth}` : name;
}

export const FATE: Partial<Record<Platoons[number]['state'], string>> = { destroyed: '파괴', broken: '무력화', overran: '진지 돌파' };
const STAGE = ['', '탐지', '병종 식별', '적정 확인'] as const;
const EFFECT = RADIO_GRAMMAR.tables.effect;

/** A unit's row: name, what the observer learnt of it, its losses, its fate (조기: down before its assault). */
export function unitRow(platoons: Platoons, pid: number): string[] {
  const p = platoons[pid]!;
  const I = p.intel;
  const cas = Math.round((100 * p.members.filter((m) => !m.alive).length) / p.members.length);
  const early = p.type === 'inf' && (p.state === 'broken' || p.state === 'destroyed') && p.assaultTick < 0;
  return [unitName(platoons, pid), I.stage ? `표적 ${I.tnum} · ${STAGE[I.stage]} (${clock(I.firstTick)})` : '미탐지', `${cas}%`, `${FATE[p.state] ?? '공격 계속'}${early ? ' · 조기' : ''}`];
}

/** 협차 (demo brk): the range corrections, each at most half the one before (+1 m) to keep the bracket. */
export function bracket(r: readonly number[]): string {
  if (r.length < 2) return r.length ? `${r[0]}` : '—';
  return `${r.join('→')} ${r.every((x, i) => i === 0 || x <= r[i - 1]! / 2 + 1) ? '✓' : '✗'}`;
}

/** A mission's row, for the missions that fired. */
export function missionRow(m: ReadonlySimState['missions'][number]): string[] {
  const word = (e: Effect | null) => (e ? EFFECT[e].text : '—');
  return [
    m.mto ? `AB${String(m.mto.targetNumber).padStart(4, '0')}` : '—',
    `${m.shift ? '전이' : RADIO_GRAMMAR.tables.warning[m.warning].text}${m.dangerClose ? ' 근접' : ''}`,
    `${m.corrections}`,
    `${m.impacts.length + m.flights.length}`,
    m.firstError === null ? '—' : `${m.firstError} m`,
    m.directionError === null ? '—' : `${m.directionError} 밀`,
    bracket(m.rangeCorrections),
    word(m.report),
    m.truth ? `${word(m.truth)} (${m.truthPct}%)` : '—',
    m.report && m.truth ? (m.report === m.truth ? '일치' : '불일치') : '',
  ];
}

/** 강평의 실전 한 줄 (#183 Q3·Q4), a combat game's only: the lases taken from the final state, the rest counted off that
 * game's 무전 기록 (기러기's 정정, the 시사탄's line, 기러기's 진지 변환 중). The screen counts; the 판 기록 holds none of it. */
export function combatLine(state: Pick<ReadonlySimState, 'mode' | 'combat'>, lines: readonly LogLine[], laserLimit: number): string | null {
  if (state.mode !== 'combat') return null;
  const said = (kind: string) => lines.filter((l) => l.type === 'radio' && l.utterance.speaker === 'fdc' && l.utterance.kind === kind).length;
  const shelled = lines.filter((l) => l.type === 'system' && l.text === RANGING_NOTE).length;
  return `실전: 쓴 레이저 ${state.combat?.lasesUsed ?? 0}/${laserLimit} · 틀린 복창 ${said('mto_correction')}회 · 적 포병 사격 ${shelled}회 · 진지 변환 ${said('displacing')}회`;
}
