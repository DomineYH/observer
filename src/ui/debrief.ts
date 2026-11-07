// 사후강평 (demo lines 1354–1366, 1531–1550): the ui's words for an ended game's units, missions and record. Pure.
import type { Effect, ReadonlySimState } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { clock } from './clock';

type Platoons = ReadonlySimState['platoons'];

/** 적 1소대, 적 2소대 … in the scenario's order, and 적 정찰조 · 적 장갑차 · 적 박격포반. */
export function unitName(platoons: Platoons, pid: number): string {
  const p = platoons[pid]!;
  if (p.type === 'inf') return `적 ${platoons.slice(0, pid + 1).filter((q) => q.type === 'inf').length}소대`;
  return { recon: '적 정찰조', apc: '적 장갑차', mortar: '적 박격포반' }[p.type];
}

const FATE: Partial<Record<Platoons[number]['state'], string>> = { destroyed: '파괴', broken: '무력화', overran: '진지 돌파' };
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
