// 관측소 이동·위치 보고·발각 (demo lines 849–904, 609–637, 1416–1420): the ui's words for the simulation's post state and
// notes. Pure.
import type { MoveBlock, MovePlan, Mode, Point, PostNote, RadioStage, ReadonlySimState, UnitType } from '@sim';
import { clock } from './clock';
import { unitName } from './debrief';

/** The 위치 보고 hint (B3): what 기러기 really does with the report, or in 표준 how to find one's own grid. */
export const POSITION_HINT: Record<Mode, string> = {
  training:
    '훈련: 기러기는 극좌표로 보낸 표적 위치를 보고한 관측소 위치에서 환산합니다. 보고하지 않으면 옛 위치에서 환산합니다. 좌표법 + 방향으로 보낸 임무에는 영향이 없습니다.',
  standard: '지도를 눌러 자기 위치를 좌표자로 읽어 넣으십시오.',
};

/** The 위치 보고 is due and its form open: at idle, once the walk and the setup are over. */
export const reportOpen = (stage: RadioStage, s: Pick<ReadonlySimState, 'post' | 'reportDue'>) => stage === 'idle' && s.post.state === 'ready' && s.reportDue;

/** Why the map's 좌표자 point cannot be moved to. */
export const BLOCKED: Record<MoveBlock, string> = {
  not_live: '작전 개시 뒤에 옮길 수 있습니다.',
  edge: '지도 가장자리입니다.',
  moving: '이미 이동 중입니다.',
  setup: '관측소 설치 중입니다.',
  mission: '사격 임무 중에는 이동할 수 없습니다. 임무끝을 먼저 보내십시오.',
};

const FOREST_SHOWN_M = 50; // less forest than this on the way is not worth a word (demo)
const m = (x: number) => `${Math.round(x).toLocaleString('ko-KR')} m`;
const eta = (sec: number) => clock(Math.ceil(sec * 20));

/** The move button's words: distance, walking time, and whether the way crosses forest. */
export const moveLabel = (p: MovePlan) => `여기로 관측소 이동 · ${m(p.dist)} · 약 ${eta(p.total)}${p.forest > FOREST_SHOWN_M ? ' · 숲 통과' : ''}`;

/** The log line when a move sets off, and the warning when it goes past the front. */
export function moveStarted(p: MovePlan, frontY: number): string[] {
  const out = [`관측소 이동 시작 — 거리 ${m(p.dist)}, 예상 ${eta(p.total)}${p.forest > FOREST_SHOWN_M ? ` (숲 ${m(p.forest)} 통과)` : ''}.`];
  if (p.to.y > frontY) out.push('목적지가 아군 전선 전방입니다. 이동 중에는 발각될 확률이 높습니다.');
  return out;
}

/** Seconds left of the walk or the setup, while the post is not ready. */
export function postLeft(s: Pick<ReadonlySimState, 'post' | 'tick'>): number {
  const p = s.post;
  return p.state === 'moving' ? p.move!.total - (s.tick - p.departed) / 20 : Math.max(0, (p.until - s.tick) / 20);
}
/** "관측소 이동 중 — 01:12" and the like, or null when ready. */
export const postStatus = (s: Pick<ReadonlySimState, 'post' | 'tick'>): string | null =>
  s.post.state === 'ready' ? null : `${s.post.state === 'moving' ? '관측소 이동 중' : '관측 장비 설치 중'} — ${eta(postLeft(s))}`;

const KIND: Record<UnitType, string> = { inf: '보병', recon: '정찰조', apc: '장갑차', mortar: '박격포' };
const FIRE = { mortar: '박격포', direct: '직사' } as const;

/** A post note as log lines; `canopy`: the post stands in forest. */
export function postNote(n: PostNote, platoons: ReadonlySimState['platoons'], canopy: boolean): string[] {
  switch (n.what) {
    case 'arrived':
      return ['관측소 도착. 관측 장비 설치 중(약 30초).'];
    case 'set_up':
      return [`관측소 설치 끝. 기러기에게 새 위치를 보고하십시오.${canopy ? ' (숲 속이라 시야가 가립니다.)' : ''}`];
    case 'compromised': {
      const I = platoons[n.pid]!.intel;
      const who = I.stage >= 1 ? `표적 ${I.tnum}(${I.stage >= 2 ? KIND[platoons[n.pid]!.type] : '미상'})` : '아직 탐지하지 못한 적';
      const out = [`관측소가 ${who}에게 발각된 것 같습니다. 곧 사격이 올 수 있습니다 — 자리를 옮기십시오.`];
      if (!n.fire) out.push('↳ 적에게 지금 관측소를 때릴 화력은 없는 것 같습니다.');
      return out;
    }
    case 'near_miss':
      return [`관측소 주변에 적 ${n.fire === 'mortar' ? '박격포탄' : '직사화기 탄'}이 떨어집니다!`];
    case 'shelling':
      return ['적 박격포탄이 아군 진지에 떨어지기 시작했습니다.'];
    case 'apc_fire':
      return ['아군 진지 방향으로 적 직사화기 사격이 시작됐습니다.'];
    case 'friendly_hit':
      return [`탄착이 아군 ${n.pos + 1}소대 진지 70 m 이내! 아군 피해 발생${n.k ? ` — ${n.k}명 손실` : ''}.`];
    case 'overrun': {
      const route = platoons[n.pid]!.route;
      return [`${unitName(platoons, n.pid)}이(가) ${route ? `아군 ${'ABC'.indexOf(route) + 1}소대` : '아군'} 진지를 돌파했습니다.`]; // demo: route A/B/C ends on our 1/2/3소대
    }
    case 'lost':
      return [`${n.cause === 'friendly' ? '아군 포탄이 관측소에 떨어졌습니다.' : `적 ${FIRE[n.cause]} 사격에 관측반이 피격됐습니다.`} 관측반 전투 불능 — 임무 종료.`];
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** After 기러기 reads a 위치 보고 back: how far the reported post is from the real one (demo 899–901). */
export function reportError(known: Point, op: Point, mode: Mode): string | null {
  const err = Math.round(dist(known, op));
  if (err > 60) return `↳ 보고한 위치가 실제 위치와 약 ${err} m 다릅니다. 극좌표로 보낸 표적 위치가 그만큼 어긋납니다(좌표법 + 방향 송신에는 영향 없음).`;
  return mode === 'training' ? `↳ (훈련) 보고 위치 오차 ${err} m.` : null;
}

export const SKIPPED = '위치 보고 생략 — 기러기는 극좌표를 이전 관측소 위치에서 환산합니다.';
/** 기러기 still knows the post somewhere else (skipped or wrong report): 극좌표 will miss by that much. */
export const staleKnown = (s: Pick<ReadonlySimState, 'knownOp' | 'op'>) => dist(s.knownOp, s.op) > 30;
