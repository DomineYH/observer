// 표적 탭 (demo lines 1088–1099): the units found, in the order found, described only as far as they have been watched.
import type { Activity, Mode, Point, ReadonlySimState, Unit, UnitType } from '@sim';
import { clock } from './clock';
import { FATE } from './debrief';

const STAGE = ['', '탐지', '병종 식별', '적정 확인'] as const;
const ACTIVITY: Record<Activity, string> = { attacking: '공격중', moving: '이동중', halted: '정지중', firing: '사격중' };
const TYPE: Record<UnitType, string> = { inf: '보병', recon: '보병', apc: '장갑차(BMP 계열 추정)', mortar: '박격포(82mm 추정)' };
const SIZE: Record<Unit, (n: number) => string> = {
  platoon: () => '1개 소대',
  platoon_minus: () => '1개 소대(-)',
  squad: () => '1개 분대',
  men: (n) => `${n}명`,
  vehicles: (n) => `${n}대`,
  tubes: (n) => `${n}문`,
  none: () => '(문수 미상)',
};

/** 훈련: the share of the unit still alive (demo `strength`, 1095), %. */
const strength = (ms: readonly { alive: boolean }[]) => Math.round((100 * ms.filter((m) => m.alive).length) / ms.length);

/** 관측 진행 (demo 1093), %: the time watched against the time to the 규모 from the unit's distance now (the simulation's
 * intel.ts: `prog` in half-ticks, 3 s + 2.5 s/km, then 6 s + 4 s/km; ui may import sim types only). */
function watched(p: ReadonlySimState['platoons'][number], op: Point): number {
  const km = Math.hypot(p.x - op.x, p.y - op.y) / 1000;
  return Math.round(Math.min(1, p.intel.prog / ((3 + 2.5 * km + 6 + 4 * km) * 40)) * 100);
}

const DIM = { color: 'var(--dim)' } as const;

export function TargetList({ platoons, mode, op }: { platoons: ReadonlySimState['platoons']; mode: Mode; op: Point }) {
  const found = platoons.filter((p) => p.intel.stage > 0).sort((a, b) => a.intel.tnum - b.intel.tnum);
  return (
    <section aria-label="표적 목록">
      <ul>
        {!found.length && <li style={DIM}>아직 식별한 표적이 없습니다. 쌍안경으로 북쪽 능선을 살피고, 적을 찾으면 화면을 누르십시오.</li>}
        {found.map((p) => {
          const I = p.intel;
          const desc = I.stage < 2 ? '미상' : `${ACTIVITY[p.activity]}인 적 ${TYPE[p.type]}${I.size ? ` ${SIZE[I.size.unit](I.size.n)}` : ''}`;
          return (
            <li key={I.tnum}>
              <b>표적 {I.tnum}</b> {desc}
              {FATE[p.state] && <span style={p.state === 'broken' ? { color: 'var(--amber)' } : undefined}> {FATE[p.state]}</span>}
              <br />
              <span style={DIM}>
                {STAGE[I.stage]} · 최초 탐지 {clock(I.firstTick)} · 마지막 관측 {clock(I.seenTick)}
                {I.stage < 3 && ` · 관측 ${watched(p, op)}%`}
                {mode === 'training' && I.stage >= 2 && ` · (훈련: 전투력 ${strength(p.members)}%)`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
